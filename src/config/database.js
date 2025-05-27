const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');
const { retryDatabaseOperation } = require('../utils/retry');

// Log database connection info (without sensitive data)
function logDatabaseInfo() {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const url = new URL(dbUrl);
      logger.info('🗄️  Database Configuration:');
      logger.info(`   - Host: ${url.hostname}`);
      logger.info(`   - Port: ${url.port || '5432'}`);
      logger.info(`   - Database: ${url.pathname.slice(1)}`);
      logger.info(`   - SSL: ${url.searchParams.get('sslmode') || 'default'}`);
    } catch (error) {
      logger.warn('⚠️  Could not parse DATABASE_URL for logging');
    }
  }
}

// Log database info on module load
logDatabaseInfo();

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
    logger.info('🔌 Attempting database connection...');
    
    // Connect with timeout
    const connectPromise = prisma.$connect();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout after 30s')), 30000);
    });
    
    await Promise.race([connectPromise, timeoutPromise]);
    logger.info('✅ Database connected successfully');
    
    // Test a simple query with timeout
    const queryPromise = prisma.$queryRaw`SELECT 1 as test`;
    const queryTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout after 15s')), 15000);
    });
    
    const result = await Promise.race([queryPromise, queryTimeoutPromise]);
    logger.info('✅ Database query test successful:', result);
  }, 'database connection test');
}

// Graceful shutdown with proper connection cleanup
async function disconnect() {
  try {
    logger.info('🔌 Disconnecting from database...');
    
    // Disconnect with timeout
    const disconnectPromise = prisma.$disconnect();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database disconnect timeout after 10s')), 10000);
    });
    
    await Promise.race([disconnectPromise, timeoutPromise]);
    logger.info('✅ Database disconnected successfully');
  } catch (error) {
    logger.error('❌ Error disconnecting from database:', error);
    // Don't throw error during shutdown to avoid hanging the process
  }
}

// Note: Signal handlers are managed by the main application
// to avoid conflicts and ensure proper shutdown order

// Export both the client and utility functions
module.exports = {
  prisma,
  testConnection,
  disconnect
}; 