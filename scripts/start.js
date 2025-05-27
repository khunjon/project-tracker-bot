#!/usr/bin/env node

require('dotenv').config();

const logger = require('../src/config/logger');

// Set up process title for easier identification
process.title = 'project-tracker-bot';

// Log startup information
logger.info('🚀 Starting Project Tracker Bot...');
logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`🐳 Platform: ${process.platform}`);
logger.info(`📦 Node.js: ${process.version}`);
logger.info(`💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

// Set NODE_ENV to production if running on Railway
if (process.env.RAILWAY_ENVIRONMENT && !process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
  logger.info('🚂 Set NODE_ENV to production for Railway deployment');
}

// Validate critical environment variables
const requiredEnvVars = [
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET', 
  'SLACK_APP_TOKEN',
  'DATABASE_URL'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error('❌ Missing required environment variables:', missingEnvVars);
  logger.error('💡 Please check your Railway environment variables or .env file');
  process.exit(1);
}

// Log configuration (without sensitive data)
logger.info('⚙️  Configuration loaded:');
logger.info(`   - Slack Bot Token: ${process.env.SLACK_BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
logger.info(`   - Slack Signing Secret: ${process.env.SLACK_SIGNING_SECRET ? '✅ Set' : '❌ Missing'}`);
logger.info(`   - Slack App Token: ${process.env.SLACK_APP_TOKEN ? '✅ Set' : '❌ Missing'}`);
logger.info(`   - Database URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Missing'}`);
logger.info(`   - OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Set' : '⚠️  Optional'}`);
logger.info(`   - General Channel ID: ${process.env.GENERAL_CHANNEL_ID ? '✅ Set' : '⚠️  Optional'}`);

// Log Railway-specific environment info
if (process.env.RAILWAY_ENVIRONMENT) {
  logger.info('🚂 Railway Environment Detected:');
  logger.info(`   - Environment: ${process.env.RAILWAY_ENVIRONMENT}`);
  logger.info(`   - Service: ${process.env.RAILWAY_SERVICE_NAME || 'unknown'}`);
  logger.info(`   - Deployment: ${process.env.RAILWAY_DEPLOYMENT_ID || 'unknown'}`);
}

// Handle startup errors gracefully
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception during startup:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection during startup:', reason);
  process.exit(1);
});

// Handle Railway container signals
process.on('SIGTERM', () => {
  logger.info('🛑 SIGTERM received in startup script - forwarding to main app');
  // The main app will handle the graceful shutdown
});

process.on('SIGINT', () => {
  logger.info('🛑 SIGINT received in startup script - forwarding to main app');
  // The main app will handle the graceful shutdown
});

// Start the application
async function start() {
  try {
    // Import and start the main application
    const app = require('../src/index');
    
    // The app will handle its own startup process
    logger.info('✅ Startup script completed successfully');
    
  } catch (error) {
    logger.error('💥 Failed to start application:', error);
    process.exit(1);
  }
}

start(); 