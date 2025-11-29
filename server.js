const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const config = require('./config');
const auth = require('./lib/auth');
const api = require('./lib/api');
const analyzer = require('./logic/analyzer');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ----------------------------------------------------
// 🧠 MEMORY BUFFER
// ----------------------------------------------------
let filteredHistory = [];
const MAX_HISTORY = 1000; 

// ----------------------------------------------------
// 🔌 API ENDPOINTS
// ----------------------------------------------------

// === GROUP 1: UI & INDEX ===

// Dashboard
app.get('/', (req, res) => res.sendFile(__dirname + '/dashboard.html'));

// API Manual (Index) - Shows all available commands
app.get('/api', (req, res) => {
    res.json({
        title: "🧟 ZOMBIE HUNTER API",
        endpoints: {
            dashboard: "http://localhost:3000/",
            stream: "http://localhost:3000/api/stream",
            clusters: "http://localhost:3000/api/clusters",
            whales: "http://localhost:3000/api/whales",
            summary: "http://localhost:3000/api/summary",
            export_csv: "http://localhost:3000/api/export",
            health: "http://localhost:3000/api/health",
            ignored: "http://localhost:3000/api/ignored",
            clear_data: "http://localhost:3000/api/clear"
        },
        examples: {
            ticker_lookup: "http://localhost:3000/api/ticker/BBCA"
        }
    });
});

// === GROUP 2: RAW DATA ===

app.get('/api/stream', (req, res) => res.json({ total_items: filteredHistory.length, data: filteredHistory }));

app.get('/api/ticker/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    const stockHistory = filteredHistory.filter(item => item.symbol === code);
    res.json({ symbol: code, count: stockHistory.length, data: stockHistory });
});

// === GROUP 3: SIGNALS ===

app.get('/api/clusters', (req, res) => {
    const clusters = filteredHistory.filter(item => item.type === 'CLUSTER');
    res.json({ count: clusters.length, data: clusters });
});

app.get('/api/whales', (req, res) => {
    const WHALE_LIMIT = 500_000_000; 
    const whales = filteredHistory.filter(item => item.valueRaw >= WHALE_LIMIT);
    res.json({ threshold: "500 Juta", count: whales.length, data: whales });
});

// === GROUP 4: ANALYSIS (New) ===

// Market Summary (Top Gainers/Losers from Buffer)
app.get('/api/summary', (req, res) => {
    const stats = {};
    filteredHistory.forEach(t => {
        if (!stats[t.symbol]) {
            stats[t.symbol] = { symbol: t.symbol, volume: 0, value: 0, change: t.change };
        }
        stats[t.symbol].volume += t.volume;
        stats[t.symbol].value += t.valueRaw;
    });

    const arr = Object.values(stats);
    res.json({
        most_active: [...arr].sort((a, b) => b.value - a.value).slice(0, 10),
        top_gainers: [...arr].filter(x => x.change > 0).sort((a, b) => b.change - a.change).slice(0, 10),
        top_losers:  [...arr].filter(x => x.change < 0).sort((a, b) => a.change - b.change).slice(0, 10)
    });
});

// CSV Export
app.get('/api/export', (req, res) => {
    let csv = "Time,Symbol,Price,Change,Volume,Value,Type\n";
    filteredHistory.forEach(t => {
        const timeStr = new Date(t.time).toLocaleTimeString('en-GB');
        const type = t.type || 'TRADE';
        csv += `${timeStr},${t.symbol},${t.price},${t.change},${t.volume},${t.valueRaw},${type}\n`;
    });
    res.header('Content-Type', 'text/csv');
    res.attachment('zombie_hunter_data.csv');
    res.send(csv);
});

// === GROUP 5: SYSTEM ===

app.get('/api/ignored', (req, res) => {
    const list = loadIgnoreList();
    res.json({ count: list.size, tickers: Array.from(list).sort() });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: "OK",
        uptime: process.uptime().toFixed(0) + " seconds",
        memory: process.memoryUsage(),
        clients: io.engine.clientsCount,
        buffer_size: filteredHistory.length
    });
});

app.get('/api/clear', (req, res) => {
    filteredHistory = [];
    res.json({ message: "History cleared" });
});

// ----------------------------------------------------
// 🛠️ HELPER: LOAD IGNORE LIST
// ----------------------------------------------------
function loadIgnoreList() {
    const ignoreSet = new Set();
    const folders = ['sleeping', 'penny', 'premium']; 

    folders.forEach(folder => {
        const dirPath = path.join(__dirname, 'data', folder);
        try {
            if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
            const files = fs.readdirSync(dirPath);
            files.forEach(file => {
                if (file.startsWith('.')) return;
                const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
                content.split(/\r?\n/).forEach(line => {
                    if (!line.trim()) return;
                    let symbol = line.split(',')[0].replace(/["']/g, '').replace('IDX:', '').replace('.JK', '').trim();
                    if (symbol.length >= 4) ignoreSet.add(symbol);
                });
            });
        } catch (e) { console.log(`⚠️ Error reading ${folder}: ${e.message}`); }
    });
    return ignoreSet;
}

// ----------------------------------------------------
// 🚀 MAIN SERVER LOOP
// ----------------------------------------------------
async function start() {
    console.log("\n===============================================");
    console.log("🧟 ZOMBIE HUNTER API SERVER STARTING...");
    console.log("===============================================");

    // 1. INITIAL AUTH
    let token = config.stockbit.token;
    
    const performLogin = async () => {
        console.log("🔓 Launching Browser to Authenticate...");
        try {
            const session = await auth.loginAndStealToken();
            if (session.browser) await session.browser.close(); 
            console.log("✅ New Token Acquired!");
            return session.token;
        } catch (e) {
            console.error("❌ Login Failed:", e.message);
            return null;
        }
    };

    if (!token) {
        token = await performLogin();
        if (!token) {
            console.error("❌ CRITICAL: Could not log in. Exiting.");
            process.exit(1);
        }
    }

    const ignoreList = loadIgnoreList();
    console.log(`🚫 IGNORE LIST LOADED: ${ignoreList.size} tickers hidden`);

    // --- NAVIGATION MENU ---
    console.log(`\n🚀 SERVER ONLINE`);
    console.log(`-----------------------------------------------`);
    console.log(`💻 UI:         http://localhost:3000/`);
    console.log(`📖 API Index:  http://localhost:3000/api`);
    console.log(`-----------------------------------------------`);
    console.log(`📡 Stream:     http://localhost:3000/api/stream`);
    console.log(`⚡ Clusters:   http://localhost:3000/api/clusters`);
    console.log(`🐋 Whales:     http://localhost:3000/api/whales`);
    console.log(`📊 Summary:    http://localhost:3000/api/summary`);
    console.log(`💾 CSV Export: http://localhost:3000/api/export`);
    console.log(`-----------------------------------------------\n`);
    
    // 3. POLLING LOOP WITH AUTO-RELOGIN
    let isRelogging = false; 

    setInterval(async () => {
        if (isRelogging) return;

        try {
            const trades = await api.fetchRunningTrade(token);
            
            if (trades && trades.length > 0) {
                const cleanAlerts = analyzer.analyze(trades, ignoreList);
                
                if (cleanAlerts.length > 0) {
                    io.emit('market_update', cleanAlerts);
                    filteredHistory.unshift(...cleanAlerts);
                    if (filteredHistory.length > MAX_HISTORY) {
                        filteredHistory = filteredHistory.slice(0, MAX_HISTORY);
                    }
                }
            }
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log("\n⛔ TOKEN EXPIRED (401)! Initiating Auto-Relogin...");
                isRelogging = true; 
                const newToken = await performLogin();
                if (newToken) {
                    token = newToken; 
                    console.log("🔄 Token Refreshed. Resuming Stream...\n");
                } else {
                    console.log("⚠️ Relogin failed. Will try again in next cycle.");
                }
                isRelogging = false; 
            } else {
                // Silent fail for network blips
            }
        }
    }, 1000);
}

server.listen(3000, () => {
    start();
});