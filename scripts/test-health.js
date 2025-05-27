#!/usr/bin/env node

const http = require('http');

async function testHealthCheck() {
  console.log('🏥 Testing health check endpoint...');
  
  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/health',
    method: 'GET',
    headers: {
      'User-Agent': 'Railway-Health-Check-Test'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ Health check response (${res.statusCode}): ${data}`);
        resolve({ statusCode: res.statusCode, data: data });
      });
    });

    req.on('error', (error) => {
      console.error('❌ Health check request failed:', error);
      reject(error);
    });

    req.setTimeout(5000, () => {
      console.error('❌ Health check timeout');
      req.destroy();
      reject(new Error('Health check timeout'));
    });

    req.end();
  });
}

async function main() {
  try {
    console.log('🚀 Starting health check test...');
    
    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const result = await testHealthCheck();
    
    if (result.statusCode === 200 && result.data === 'OK') {
      console.log('✅ Health check test passed!');
      process.exit(0);
    } else {
      console.error('❌ Health check test failed - unexpected response');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Health check test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testHealthCheck }; 