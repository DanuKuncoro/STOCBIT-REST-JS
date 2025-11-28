require('dotenv').config();

module.exports = {
    // 1. Credentials & API
    stockbit: {
        token: process.env.STOCKBIT_TOKEN,
        userId: process.env.STOCKBIT_USER_ID,
        apiUrl: 'https://exodus.stockbit.com/order-trade/running-trade',
        loginUrl: 'https://stockbit.com/login',
        homeUrl: 'https://stockbit.com/stream' 
    },

    // 2. Strategy Rules
    strategy: {
        // UNFILTERED MODE: Show anything 1 lot or bigger
        min_volume_lot: 1, 
        
        // Cluster settings (Still useful to see speed)
        cluster_window_ms: 1000, 
        cluster_min_hits: 3
    }
};