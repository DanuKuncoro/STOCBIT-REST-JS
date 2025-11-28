require('dotenv').config();

module.exports = {
    // 1. Credentials & API
    stockbit: {
        token: process.env.STOCKBIT_TOKEN,
        userId: process.env.STOCKBIT_USER_ID,
        url: process.env.STOCKBIT_URL || 'https://stockbit.com/stream'
    },

    // 2. Strategy Rules
    strategy: {
        // Alert if trade size is > 1000 lots
        min_volume_lot: 1000, 
        
        // Alert if we see 3+ trades in 5 seconds
        cluster_window_ms: 5000, 
        cluster_min_hits: 3
    }
};