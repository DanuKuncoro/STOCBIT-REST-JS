require('dotenv').config(); // Load Token from .env
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const analyzer = require('./logic/analyzer');

// ----------------------------------------------------
// 🛠️ HELPER: FOLDER SCANNER
// ----------------------------------------------------
function loadFromFolder(folderName) {
    const dirPath = path.join(__dirname, 'data', folderName);
    const uniqueTickers = new Set();
    try {
        if (!fs.existsSync(dirPath)) {
            console.log(`⚠️  Folder not found: data/${folderName}`);
            return [];
        }
        const files = fs.readdirSync(dirPath);
        files.forEach(file => {
            if (file.startsWith('.')) return; // Skip hidden files
            const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
            content.split(/\r?\n/).forEach(line => {
                if (!line.trim()) return;
                // Parse CSV logic
                let symbol = line.split(',')[0]
                    .replace(/["']/g, '')
                    .replace('IDX:', '')
                    .replace('.JK', '')
                    .trim();
                if (symbol.length >= 4) uniqueTickers.add(symbol);
            });
        });
        return Array.from(uniqueTickers);
    } catch (e) {
        console.log(`❌ Error reading ${folderName}: ${e.message}`);
        return [];
    }
}

// ----------------------------------------------------
// 1. CONFIGURATION & SETUP
// ----------------------------------------------------
const API_URL = "https://exodus.stockbit.com/order-trade/running-trade";
const TOKEN = process.env.STOCKBIT_TOKEN;

async function runRealTest() {
    console.log("🧪 STARTING REAL API TEST (FOLDER MODE)...");
    console.log("-------------------------------------------");
    
    if (!TOKEN) {
        console.error("❌ NO TOKEN FOUND in .env file.");
        console.error("👉 Run 'node server.js' first to login and get a token.");
        return;
    }

    // 2. LOAD REAL DATA FROM FOLDERS
    console.log("📂 Loading Watchlists from disk...");
    const watchlists = {
        sleeping: loadFromFolder('sleeping'),
        penny:    loadFromFolder('penny'),
        premium:  loadFromFolder('premium')
    };

    const totalCount = watchlists.sleeping.length + watchlists.penny.length + watchlists.premium.length;
    console.log(`   💀 [SLEEPING] : ${watchlists.sleeping.length}`);
    console.log(`   🪙 [PENNY]    : ${watchlists.penny.length}`);
    console.log(`   💎 [PREMIUM]  : ${watchlists.premium.length}`);
    console.log(`   🔥 TOTAL      : ${totalCount} tickers`);

    if (totalCount === 0) {
        console.log("⚠️  WARNING: No stocks found in data folders. Please add CSV files.");
    }

    try {
        console.log("\n📡 Connecting to Stockbit Exodus...");
        
        // 3. FETCH REAL DATA
        const response = await axios.get(API_URL, {
            params: {
                sort: 'DESC',
                limit: 50,
                order_by: 'RUNNING_TRADE_ORDER_BY_TIME'
            },
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://stockbit.com',
                'Referer': 'https://stockbit.com/'
            },
            // Short timeout for test
            timeout: 5000 
        });

        const rawData = response.data?.data?.running_trade || [];
        console.log(`✅ Received ${rawData.length} trades from API.`);

        if (rawData.length === 0) {
            console.log("⚠️  API returned 0 trades. Market might be closed.");
            return;
        }

        // 4. CLEAN & PARSE DATA
        const cleanTrades = rawData.map(t => ({
            symbol: t.code,
            price: parseNumber(t.price),
            volume: parseNumber(t.lot),
            change: parseFloat((t.change || "0").replace('%', '').replace('+', '')),
            time: Date.now() 
        }));

        // 5. RUN ANALYZER
        console.log("-------------------------------------------");
        console.log("🔍 ANALYZING AGAINST WATCHLIST...");
        const alerts = analyzer.analyze(cleanTrades, watchlists);

        // 6. PRINT RESULTS
        if (alerts.length === 0) {
            console.log("❌ No matches found.");
            console.log("   (None of the incoming trades were in your CSV files)");
        } else {
            alerts.forEach(alert => {
                console.log(alert.msg);
            });
        }

        console.log("-------------------------------------------");
        console.log(`✅ Test Complete. Generated ${alerts.length} alerts.`);

    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error("⛔ TOKEN EXPIRED (401). Please run 'node server.js' to re-login.");
        } else {
            console.error("❌ API Error:", error.message);
        }
    }
}

// Helper to remove commas
function parseNumber(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    return parseFloat(str.replace(/,/g, ''));
}

runRealTest();