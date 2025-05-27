require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('./config/logger');
const SlackApp = require('./slack/app');

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
    
    this.setupExpress();
  }

  setupExpress() {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());
    
    // Body parsing middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const status = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        slack: this.slackApp ? this.slackApp.getStatus() : { isRunning: false }
      };
      
      res.json(status);
    });

    // Status endpoint
    this.app.get('/status', (req, res) => {
      const status = {
        service: 'project-tracker-bot',
        version: '1.0.0',
        status: 'running',
        slack: this.slackApp ? this.slackApp.getStatus() : { isRunning: false },
        database: 'connected', // Could add actual DB health check
        features: {
          slashCommands: ['/project-new', '/project-update', '/project-list'],
          weeklyDigest: true,
          aiAnalysis: true
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
      // Initialize Slack app
      this.slackApp = new SlackApp();
      await this.slackApp.start();

      // Start Express server
      const port = process.env.PORT || 3000;
      this.server = this.app.listen(port, () => {
        logger.info(`🚀 Project Tracker Bot started successfully`);
        logger.info(`📡 Express server running on port ${port}`);
        logger.info(`🤖 Slack bot is active and listening for commands`);
        logger.info(`📊 Weekly digest scheduled for Mondays at 9:00 AM`);
      });

      // Handle server errors
      this.server.on('error', (error) => {
        logger.error('Server error:', error);
      });

    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  async stop() {
    logger.info('Shutting down Project Tracker Bot...');

    try {
      // Stop Slack app
      if (this.slackApp) {
        await this.slackApp.stop();
      }

      // Stop Express server
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
      }

      logger.info('Project Tracker Bot shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Create and start the application
const bot = new ProjectTrackerBot();

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, starting graceful shutdown');
  await bot.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, starting graceful shutdown');
  await bot.stop();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
bot.start().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

module.exports = bot; 