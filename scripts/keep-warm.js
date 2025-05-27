// Simple script to keep Railway app warm
// You can run this from a cron job or external service

const https = require('https');

const RAILWAY_URL = process.env.RAILWAY_URL || 'https://your-app.railway.app';

function pingApp() {
  const url = `${RAILWAY_URL}/health`;
  
  https.get(url, (res) => {
    console.log(`Ping successful: ${res.statusCode}`);
  }).on('error', (err) => {
    console.log(`Ping failed: ${err.message}`);
  });
}

// Ping every 10 minutes to keep app warm
setInterval(pingApp, 10 * 60 * 1000);

console.log(`Keeping ${RAILWAY_URL} warm...`);
pingApp(); // Initial ping 