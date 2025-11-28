const axios = require('axios');
const config = require('../config');

// NEW ENDPOINT (Exodus)
const API_URL = 'https://exodus.stockbit.com/order-trade/running-trade';

async function fetchRunningTrade(token) {
    try {
        const response = await axios.get(API_URL, {
            // Add the specific query parameters here
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
            timeout: 5000
        });

        // The Exodus API usually returns data in this structure:
        // { message: "success", data: [ ...trades... ] }
        return response.data?.data || [];

    } catch (error) {
        // Log detailed error if the format is unexpected
        if (error.response) {
            console.log(`⛔ API Error: ${error.response.status} - ${error.response.statusText}`);
            if (error.response.status === 401) {
                console.log("👉 Token is likely expired or invalid for the Exodus endpoint.");
            }
        } else {
            console.log(`⛔ Connection Error: ${error.message}`);
        }
        return [];
    }
}

module.exports = { fetchRunningTrade };