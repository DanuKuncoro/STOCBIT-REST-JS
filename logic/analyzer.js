const config = require('../config');
let tradeHistory = {}; 

function analyze(trades, watchlists) {
    const alerts = [];
    const now = Date.now();
    const WINDOW_MS = config.strategy.cluster_window_ms || 1000;
    const MIN_HITS = config.strategy.cluster_min_hits || 3;
    const FILTER_VOL = 1; // Send everything to UI, let UI filter it

    trades.forEach(trade => {
        
        // 1. IDENTIFY CATEGORY
        let category = "unknown";
        if (watchlists.sleeping.includes(trade.symbol)) category = "sleeping";
        else if (watchlists.penny.includes(trade.symbol)) category = "penny";
        else if (watchlists.premium.includes(trade.symbol)) category = "premium";
        else return;

        // Calculate Value
        const valueRaw = (trade.price * trade.volume * 100);
        const valueFormatted = valueRaw > 1000000000 
            ? `${(valueRaw/1000000000).toFixed(1)}M` 
            : `${(valueRaw/1000000).toFixed(0)}jt`;

        // 2. TRADE ALERT
        if (trade.volume >= FILTER_VOL) {
            alerts.push({
                type: 'TRADE',
                category: category,
                symbol: trade.symbol,
                price: trade.price,
                volume: trade.volume,
                
                // NEW DATA FOR FILTERS
                change: trade.change,       // e.g. 3.5
                valueRaw: valueRaw,         // e.g. 50000000
                
                value: valueFormatted,
                time: now,
                msg: `Trade: ${trade.symbol}`
            });
        }

        // 3. CLUSTER ALERT
        if (!tradeHistory[trade.symbol]) tradeHistory[trade.symbol] = [];
        tradeHistory[trade.symbol].push(now);
        tradeHistory[trade.symbol] = tradeHistory[trade.symbol].filter(t => now - t < WINDOW_MS);

        if (tradeHistory[trade.symbol].length >= MIN_HITS) {
            alerts.push({
                type: 'CLUSTER',
                category: category,
                symbol: trade.symbol,
                count: tradeHistory[trade.symbol].length,
                change: trade.change,
                valueRaw: 0, // Clusters don't have single value
                value: "-",
                time: now,
                msg: `Cluster: ${trade.symbol}`
            });
            tradeHistory[trade.symbol] = []; 
        }
    });

    return alerts;
}

module.exports = { analyze };