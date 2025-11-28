const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');

// Import your existing modules
const config = require('./config');
const auth = require('./lib/auth');
const api = require('./lib/api');
const analyzer = require('./logic/analyzer');

// App Setup
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve the UI file (index.html)
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// ----------------------------------------------------
// COPY OF YOUR DATA LOADING LOGIC
// ----------------------------------------------------
function loadFromFolder(folderName) {
    const dirPath = path.join(__dirname, 'data', folderName);
    const uniqueTickers = new Set();
    try {
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
        const files = fs.readdirSync(dirPath);
        files.forEach(file => {
            if (file.startsWith('.')) return;
            const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
            content.split(/\r?\n/).forEach(line => {
                if (!line.trim()) return;
                let symbol = line.split(',')[0].replace(/["']/g, '').replace('IDX:', '').replace('.JK', '').trim();
                if (symbol.length >= 4) uniqueTickers.add(symbol);
            });
        });
        return Array.from(uniqueTickers);
    } catch (e) { return []; }
}

async function start() {
    console.log("🌐 ZOMBIE HUNTER WEB SERVER STARTING...");

    // 1. Auth
    if (typeof auth.loginAndStealToken !== 'function') return console.error("❌ Auth broken");
    let token = config.stockbit.token;
    if (!token) {
        console.log("🔓 Authenticating...");
        const session = await auth.loginAndStealToken();
        token = session.token;
    }

    // 2. Load Data
    const watchlists = {
        sleeping: loadFromFolder('sleeping'),
        penny:    loadFromFolder('penny'),
        premium:  loadFromFolder('premium')
    };
    
    const total = watchlists.sleeping.length + watchlists.penny.length + watchlists.premium.length;
    console.log(`📋 Watchlist Loaded: ${total} tickers`);

    // 3. Start Loop
    console.log(`🚀 Stream Active! Open http://localhost:3000`);
    
    setInterval(async () => {
        try {
            const trades = await api.fetchRunningTrade(token);
            if (trades && trades.length > 0) {
                const alerts = analyzer.analyze(trades, watchlists);
                
                if (alerts.length > 0) {
                    // Send to Browser
                    io.emit('market_update', alerts);
                    
                    // Still log to console
                    alerts.forEach(a => console.log(a.msg));
                }
            }
        } catch (error) {
            // silent fail
        }
    }, 1000);
}

server.listen(3000, () => {
    start();
});