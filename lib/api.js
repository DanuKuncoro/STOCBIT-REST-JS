const axios = require('axios');
const config = require('../config');

async function fetchRunningTrade(token) {
    try {
        const response = await axios.get(config.stockbit.apiUrl, {
            params: {
                sort: 'DESC',
                limit: 50,
                order_by: 'RUNNING_TRADE_ORDER_BY_TIME'
            },
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://stockbit.com',
                'Referer': 'https://stockbit.com/'
            },
            timeout: 900
        });

        const rawData = response.data?.data?.running_trade || [];

        const cleanData = rawData.map(trade => {
            return {
                symbol: trade.code, 
                action: trade.action,
                time: trade.time,
                
                // Parse Numbers
                price: parseStockbitNumber(trade.price),
                volume: parseStockbitNumber(trade.lot),
                
                // Parse Change (Remove % and + signs)
                change: parseFloat((trade.change || "0").replace('%', '').replace('+', '')),
                
                raw_price: trade.price,
                raw_lot: trade.lot
            };
        });

        return cleanData;

    } catch (error) {
        // If token expired (401), throw error so main loop handles it
        if (error.response && error.response.status === 401) throw error; 
        return [];
    }
}

// Helper: Turns "10,805.50" into 10805.5
function parseStockbitNumber(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    return parseFloat(str.replace(/,/g, ''));
}

module.exports = { fetchRunningTrade };