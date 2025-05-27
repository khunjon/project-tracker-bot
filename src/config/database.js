const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');
const { retryDatabaseOperation } = require('../utils/retry');

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Add connection pool configuration for Railway
  __internal: {
    engine: {
      connectionTimeout: 20000,
      queryTimeout: 60000,
    },
  },
});

// Log database queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug('Query: ' + e.query);
    logger.debug('Params: ' + e.params);
    logger.debug('Duration: ' + e.duration + 'ms');
  });
}

prisma.$on('error', (e) => {
  logger.error('Database error:', e);
});

prisma.$on('info', (e) => {
  logger.info('Database info:', e);
});

prisma.$on('warn', (e) => {
  logger.warn('Database warning:', e);
});

// Test database connection on startup with retry
async function testConnection() {
  return retryDatabaseOperation(async () => {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
    
    // Test a simple query
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database query test successful');
  }, 'database connection test');
}

// Graceful shutdown with proper connection cleanup
async function disconnect() {
  try {
    logger.info('🔌 Disconnecting from database...');
    await prisma.$disconnect();
    logger.info('✅ Database disconnected successfully');
  } catch (error) {
    logger.error('❌ Error disconnecting from database:', error);
    throw error;
  }
}

// Handle process termination signals
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received - closing database connections');
  await disconnect();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received - closing database connections');
  await disconnect();
});

process.on('beforeExit', async () => {
  logger.info('Process beforeExit - closing database connections');
  await disconnect();
});

// Export both the client and utility functions
module.exports = {
  prisma,
  testConnection,
  disconnect
}; 