const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const config = require('../config');

async function loginAndStealToken() {
    console.log("🔓 Launching Browser (Network Sniffer Mode)...");
    console.log(`👉 Navigating to: ${config.stockbit.loginUrl}`);

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();
    
    // ---------------------------------------------------------
    // 🕵️ NEW STRATEGY: NETWORK SNIFFER
    // ---------------------------------------------------------
    // We listen to every request the browser makes.
    // If we see "Authorization: Bearer ...", we grab it!
    
    let foundToken = null;

    page.on('request', (request) => {
        const headers = request.headers();
        // Check for 'authorization' (Puppeteer lowercases headers)
        const auth = headers['authorization'] || headers['Authorization'];

        if (auth && auth.startsWith('Bearer ') && !foundToken) {
            const possibleToken = auth.replace('Bearer ', '');
            
            // Filter out short junk tokens, we want the long JWT
            if (possibleToken.length > 50) {
                console.log("⚡ INTERCEPTED TOKEN from Network Traffic!");
                foundToken = possibleToken;
            }
        }
    });

    // ---------------------------------------------------------
    // NAVIGATION
    // ---------------------------------------------------------
    try {
        await page.goto(config.stockbit.loginUrl, { waitUntil: 'networkidle2' });
    } catch (e) {
        // Ignore navigation timeouts, we just need the browser open
    }

    console.log("⏳ Waiting for you to log in...");
    console.log("   (I am watching the XHR headers for the token...)");

    // Wait until the token variable is filled
    while (!foundToken) {
        // Safety check: stop if you close the browser
        if (browser.isConnected() === false) {
            console.error("❌ Browser closed before token was found.");
            process.exit(1);
        }
        // Check every 500ms
        await new Promise(r => setTimeout(r, 500));
    }

    console.log("✅ TOKEN ACQUIRED!");

    // Optional: Try to get User ID (not critical)
    let userId = 'UNKNOWN';
    try {
        const userStr = await page.evaluate(() => localStorage.getItem('user'));
        if (userStr) userId = JSON.parse(userStr).username;
    } catch (e) {}

    // ---------------------------------------------------------
    // SAVE TO .ENV
    // ---------------------------------------------------------
    const envPath = path.resolve(__dirname, '../.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }

    const updateEnvKey = (key, value) => {
        const regex = new RegExp(`^${key}=.*`, 'm');
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
            envContent += `\n${key}=${value}`;
        }
    };

    updateEnvKey('STOCKBIT_TOKEN', foundToken);
    updateEnvKey('STOCKBIT_USER_ID', userId);

    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log("💾 Credentials saved to .env");

    // Redirect to Home
    console.log(`👉 Redirecting to Home: ${config.stockbit.homeUrl}`);
    try {
        await page.goto(config.stockbit.homeUrl, { waitUntil: 'domcontentloaded' });
    } catch (e) {}
    
    return { browser, token: foundToken };
}

module.exports = { loginAndStealToken };