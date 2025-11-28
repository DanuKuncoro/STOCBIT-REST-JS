const fs = require('fs');
const path = require('path');
const config = require('./config');
const auth = require('./lib/auth');
const api = require('./lib/api');
const analyzer = require('./logic/analyzer');

// ----------------------------------------------------
// 🛠️ HELPER: FOLDER SCANNER
// ----------------------------------------------------
function loadFromFolder(folderName) {
    const dirPath = path.join(__dirname, 'data', folderName);
    const uniqueTickers = new Set(); 

    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            return [];
        }

        const files = fs.readdirSync(dirPath);
        if (files.length === 0) return [];

        console.log(`   📂 Scanning data/${folderName}/... found ${files.length} files.`);

        files.forEach(file => {
            if (file.startsWith('.')) return;

            const filePath = path.join(dirPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split(/\r?\n/);

            lines.forEach(line => {
                if (!line.trim()) return;
                const columns = line.split(',');
                let symbol = columns[0]
                    .replace(/"/g, '')
                    .replace('IDX:', '')
                    .replace('.JK', '')
                    .trim();

                if (symbol.length >= 4 && /^[A-Z0-9]+$/.test(symbol)) {
                    uniqueTickers.add(symbol);
                }
            });
        });

        return Array.from(uniqueTickers);

    } catch (e) {
        console.log(`⚠️  Error scanning ${folderName}: ${e.message}`);
        return [];
    }
}

async function start() {
    console.log("---------------------------------------");
    console.log("🧟 ZOMBIE HUNTER: 1-SECOND BURST MODE");
    console.log("---------------------------------------");

    // 1. AUTHENTICATION
    if (typeof auth.loginAndStealToken !== 'function') {
        console.error("❌ CRITICAL: lib/auth.js is broken.");
        process.exit(1);
    }

    let token = config.stockbit.token;
    if (!token) {
        console.log("🔓 Launching Network Sniffer...");
        try {
            const session = await auth.loginAndStealToken();
            token = session.token;
        } catch (e) {
            console.log("❌ Login failed. Exiting.");
            process.exit(1);
        }
    } else {
        console.log("✅ Token loaded.");
    }

    // 2. LOAD DATA
    console.log("📂 Loading Watchlists...");
    
    const watchlists = {
        sleeping: loadFromFolder('sleeping'),
        penny:    loadFromFolder('penny'),
        premium:  loadFromFolder('premium')
    };

    const total = watchlists.sleeping.length + watchlists.penny.length + watchlists.premium.length;

    console.log(`   💀 [SLEEPING] : ${watchlists.sleeping.length}`);
    console.log(`   🪙 [PENNY]    : ${watchlists.penny.length}`);
    console.log(`   💎 [PREMIUM]  : ${watchlists.premium.length}`);
    console.log(`   🔥 TOTAL      : ${total}`);

    if (total === 0) console.log("⚠️  No CSV files found in data/ folders.");

    // 3. START STREAM
    console.log("\n🚀 STARTING HIGH-SPEED STREAM (1s)...");
    
    // FAST POLLING: 1000ms
    setInterval(async () => {
        try {
            const trades = await api.fetchRunningTrade(token);
            
            if (trades && trades.length > 0) {
                const alerts = analyzer.analyze(trades, watchlists);
                if (alerts.length > 0) {
                    alerts.forEach(alert => console.log(alert.msg));
                }
            }
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log("⛔ Token Expired! Restarting...");
                process.exit(1);
            }
        }
    }, 1000); // <--- 1 SECOND INTERVAL
}

start();