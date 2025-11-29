// logic/analyzer.js
const config = require('../config');

// CONFIGURATION
const CLUSTER_WINDOW_MS = 1000; 
const MIN_FREQ_MODERATE = 3;    
const MIN_FREQ_STRONG = 10;     
const MAX_LAG_MS = 30000; 

// MEMORY
let tradeTimestamps = {}; 
let processedCache = new Set();

function parseTradeTime(timeStr) {
    if (!timeStr) return Date.now();
    if (typeof timeStr === 'number') return timeStr;
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, seconds, 0);
    return date.getTime();
}

function analyze(trades, ignoreList) {
    const alerts = [];
    const serverNow = Date.now(); 

    // Cleanup Cache
    if (processedCache.size > 5000) processedCache.clear();

    trades.forEach(trade => {
        // 1. SKIP IGNORED STOCKS (Blacklist)
        if (ignoreList.has(trade.symbol)) return;

        // 2. ✨ SKIP NON-RG BOARDS (The Fix) ✨
        // If the API says it's 'NG' (Negotiated) or 'TN' (Cash), we skip it.
        // We only want 'RG' (Regular).
        if (trade.board && trade.board !== 'RG') {
            return;
        }

        // 3. DEDUPLICATION
        const signature = `${trade.symbol}_${trade.time}_${trade.volume}_${trade.price}`;
        if (processedCache.has(signature)) return;
        processedCache.add(signature);

        // ------------------------------------------------------
        // PROCESSING
        // ------------------------------------------------------
        const tradeTime = parseTradeTime(trade.time);
        const valRaw = trade.price * trade.volume * 100;
        
        // A. CLUSTER ENGINE
        const isFresh = (serverNow - tradeTime) < MAX_LAG_MS;

        if (isFresh) {
            if (!tradeTimestamps[trade.symbol]) tradeTimestamps[trade.symbol] = [];
            
            tradeTimestamps[trade.symbol].push(tradeTime);
            tradeTimestamps[trade.symbol] = tradeTimestamps[trade.symbol].filter(t => tradeTime - t < CLUSTER_WINDOW_MS && tradeTime - t >= 0);

            const freq = tradeTimestamps[trade.symbol].length;

            if (freq === MIN_FREQ_MODERATE || freq === MIN_FREQ_STRONG || (freq > MIN_FREQ_STRONG && freq % 10 === 0)) {
                let strength = 'LOW';
                if (freq >= MIN_FREQ_STRONG) strength = 'STRONG';
                else if (freq >= MIN_FREQ_MODERATE) strength = 'MODERATE';

                alerts.push({
                    type: 'CLUSTER',
                    symbol: trade.symbol,
                    price: trade.price,
                    side: trade.change >= 0 ? 'buy' : 'sell',
                    time: tradeTime, 
                    freq: freq,
                    strength: strength,
                    value: valRaw
                });
            }
        }

        // B. RUNNING TRADE ENGINE
        alerts.push({
            type: 'TRADE',
            symbol: trade.symbol,
            price: trade.price,
            change: trade.change,
            volume: trade.volume,
            valueRaw: valRaw,
            time: tradeTime
        });
    });

    return alerts;
}

module.exports = { analyze };