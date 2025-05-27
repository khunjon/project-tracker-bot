require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('./config/logger');
const SlackApp = require('./slack/app');
const { testConnection, disconnect } = require('./config/database');
const { requestLogger, errorLogger, createHealthMonitor } = require('./middleware/monitoring');

// Validate required environment variables
const requiredEnvVars = [
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET',
  'SLACK_APP_TOKEN',
  'DATABASE_URL'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

class ProjectTrackerBot {
  constructor() {
    this.app = express();
    this.slackApp = null;
    this.server = null;
    this.healthMonitor = createHealthMonitor();
    
    this.setupExpress();
  }

  setupExpress() {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());
    
    // Monitoring middleware
    this.app.use(requestLogger);
    this.app.use(this.healthMonitor.middleware);
    
    // Body parsing middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Health check endpoint (simple, no database check to avoid connection issues)
    this.app.get('/health', (req, res) => {
      // Log health checks from Railway (but not too frequently)
      const userAgent = req.headers['user-agent'] || '';
      if (userAgent.includes('Railway') || userAgent.includes('health')) {
        logger.debug('🏥 Railway health check received');
      }
      
      const status = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        slack: this.slackApp ? this.slackApp.getStatus() : { isRunning: false }
      };
      
      res.json(status);
    });

    // Database health check endpoint (separate from main health check)
    this.app.get('/health/database', async (req, res) => {
      try {
        // Test database connection with timeout
        const { prisma } = require('./config/database');
        const queryPromise = prisma.$queryRaw`SELECT 1 as health_check`;
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database health check timeout')), 5000);
        });
        
        await Promise.race([queryPromise, timeoutPromise]);
        
        res.json({
          status: 'healthy',
          database: 'connected',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Database health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          database: 'disconnected',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Status endpoint with detailed monitoring
    this.app.get('/status', (req, res) => {
      const stats = this.healthMonitor.getStats();
      const status = {
        service: 'project-tracker-bot',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(stats.uptime / 1000), // Convert to seconds
        slack: this.slackApp ? this.slackApp.getStatus() : { isRunning: false },
        database: 'connected',
        monitoring: {
          requestCount: stats.requestCount,
          errorCount: stats.errorCount,
          errorRate: Math.round(stats.errorRate * 100) / 100,
          memoryUsage: {
            used: Math.round(stats.memoryUsage.heapUsed / 1024 / 1024),
            total: Math.round(stats.memoryUsage.heapTotal / 1024 / 1024),
            external: Math.round(stats.memoryUsage.external / 1024 / 1024)
          }
        },
        features: {
          slashCommands: ['/project-new', '/project-update', '/project-list'],
          weeklyDigest: true,
          aiAnalysis: !!process.env.OPENAI_API_KEY
        }
      };
      
      res.json(status);
    });

    // Manual digest trigger endpoint (for testing)
    this.app.post('/trigger-digest', async (req, res) => {
      try {
        if (!this.slackApp) {
          return res.status(503).json({ error: 'Slack app not initialized' });
        }

        await this.slackApp.triggerWeeklyDigest();
        
        res.json({ 
          success: true, 
          message: 'Weekly digest triggered successfully' 
        });
        
        logger.info('Manual digest trigger requested');
      } catch (error) {
        logger.error('Error triggering manual digest:', error);
        res.status(500).json({ 
          error: 'Failed to trigger digest',
          message: error.message 
        });
      }
    });

    // Manual shutdown trigger endpoint (for testing)
    this.app.post('/shutdown', (req, res) => {
      logger.info('🛑 Manual shutdown requested via API');
      res.json({ 
        success: true, 
        message: 'Shutdown initiated' 
      });
      
      // Trigger shutdown after response is sent
      setTimeout(() => {
        process.kill(process.pid, 'SIGTERM');
      }, 100);
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Project Tracker Bot',
        description: 'Slack bot for project management with PostgreSQL and OpenAI integration',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
          health: '/health',
          status: '/status',
          triggerDigest: 'POST /trigger-digest'
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist'
      });
    });

    // Error handling middleware
    this.app.use(errorLogger);
    this.app.use((err, req, res, next) => {
      logger.error('Express error:', err);
      
      res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });

    logger.info('Express app configured');
  }

  async start() {
    try {
      logger.info('🚀 Starting Project Tracker Bot application...');
      logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🐳 Platform: ${process.platform}`);
      logger.info(`📦 Node.js: ${process.version}`);
      
      // Test database connection first
      logger.info('🔌 Testing database connection...');
      await testConnection();

      // Initialize Slack app
      logger.info('🤖 Initializing Slack app...');
      this.slackApp = new SlackApp();
      await this.slackApp.start();

      // Start Express server
      const port = process.env.PORT || 3000;
      this.server = this.app.listen(port, '0.0.0.0', () => {
        logger.info(`🚀 Project Tracker Bot started successfully`);
        logger.info(`📡 Express server running on 0.0.0.0:${port}`);
        logger.info(`🤖 Slack bot is active and listening for commands`);
        logger.info(`📊 Weekly digest scheduled for Mondays at 9:00 AM`);
        logger.info(`🏥 Health check available at /health`);
        logger.info(`📊 Status endpoint available at /status`);
      });

      // Handle server errors
      this.server.on('error', (error) => {
        logger.error('❌ Server error:', error);
      });

      // Set up keep-alive for Railway
      this.setupKeepAlive();

      logger.info('✅ Application startup completed successfully');

    } catch (error) {
      logger.error('💥 Failed to start application:', error);
      await this.cleanup();
      process.exit(1);
    }
  }

  setupKeepAlive() {
    // Send periodic health checks to prevent Railway from sleeping
    if (process.env.NODE_ENV === 'production') {
      this.keepAliveInterval = setInterval(() => {
        logger.debug('Keep-alive ping');
      }, 25 * 60 * 1000); // Every 25 minutes
      logger.info('✅ Keep-alive interval started');
    }
  }

  async cleanup() {
    logger.info('🧹 Cleaning up resources...');
    
    try {
      // Clear any intervals
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        logger.info('✅ Cleared keep-alive interval');
      }

      // Disconnect from database with timeout
      logger.info('🔌 Starting database cleanup...');
      const cleanupPromise = disconnect();
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          logger.warn('⏰ Database cleanup timeout, continuing shutdown');
          resolve();
        }, 8000); // 8 second timeout for cleanup
      });
      
      await Promise.race([cleanupPromise, timeoutPromise]);
      logger.info('✅ Database cleanup completed');
    } catch (error) {
      logger.error('❌ Error during cleanup:', error);
      // Continue with shutdown even if cleanup fails
    }
  }

  async stop() {
    logger.info('🛑 Shutting down Project Tracker Bot...');

    try {
      // Stop Slack app first (this stops cron jobs)
      if (this.slackApp) {
        logger.info('🤖 Stopping Slack app...');
        await this.slackApp.stop();
      }

      // Stop Express server
      if (this.server) {
        logger.info('📡 Stopping Express server...');
        await new Promise((resolve, reject) => {
          this.server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }

      // Wait a moment for any pending operations to complete
      logger.info('⏳ Waiting for pending operations to complete...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Clean up resources (including database connections)
      await this.cleanup();

      logger.info('✅ Project Tracker Bot shut down successfully');
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      throw error;
    }
  }
}

// Create and start the application
const bot = new ProjectTrackerBot();

// Graceful shutdown handling for Railway containers
let isShuttingDown = false;
let shutdownTimeout;

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.warn(`${signal} received again, forcing immediate exit`);
    process.exit(1);
  }
  
  isShuttingDown = true;
  logger.info(`🛑 ${signal} received from Railway, starting graceful shutdown`);
  logger.info(`📊 Process stats at shutdown: PID=${process.pid}, uptime=${Math.floor(process.uptime())}s`);
  
  // Set a timeout to force exit if graceful shutdown takes too long
  shutdownTimeout = setTimeout(() => {
    logger.error('⏰ Graceful shutdown timeout (25s), forcing exit');
    logger.error('💀 This may indicate hanging connections or processes');
    process.exit(1);
  }, 25000); // 25 seconds timeout for Railway
  
  try {
    const shutdownStart = Date.now();
    await bot.stop();
    const shutdownDuration = Date.now() - shutdownStart;
    
    clearTimeout(shutdownTimeout);
    logger.info(`✅ Graceful shutdown completed successfully in ${shutdownDuration}ms`);
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    logger.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception:', error);
  try {
    await bot.cleanup();
  } catch (cleanupError) {
    logger.error('Error during cleanup after uncaught exception:', cleanupError);
  }
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  try {
    await bot.cleanup();
  } catch (cleanupError) {
    logger.error('Error during cleanup after unhandled rejection:', cleanupError);
  }
  process.exit(1);
});

// Start the application
bot.start().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

module.exports = bot; 