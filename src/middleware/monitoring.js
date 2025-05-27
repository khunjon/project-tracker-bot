const logger = require('../config/logger');

// Request logging middleware
function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, url, ip, headers } = req;
  
  // Log incoming request
  logger.info(`📥 ${method} ${url}`, {
    ip: ip || headers['x-forwarded-for'] || 'unknown',
    userAgent: headers['user-agent'] || 'unknown',
    timestamp: new Date().toISOString()
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    // Determine log level based on status code
    const logLevel = statusCode >= 500 ? 'error' : 
                    statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel](`📤 ${method} ${url} ${statusCode}`, {
      duration: `${duration}ms`,
      statusCode,
      timestamp: new Date().toISOString()
    });
    
    originalEnd.apply(this, args);
  };

  next();
}

// Error logging middleware
function errorLogger(err, req, res, next) {
  const { method, url, ip, headers } = req;
  
  logger.error(`💥 Error in ${method} ${url}`, {
    error: err.message,
    stack: err.stack,
    ip: ip || headers['x-forwarded-for'] || 'unknown',
    userAgent: headers['user-agent'] || 'unknown',
    timestamp: new Date().toISOString()
  });

  next(err);
}

// Health monitoring
function createHealthMonitor() {
  const startTime = Date.now();
  let requestCount = 0;
  let errorCount = 0;

  return {
    middleware: (req, res, next) => {
      requestCount++;
      
      const originalEnd = res.end;
      res.end = function(...args) {
        if (res.statusCode >= 500) {
          errorCount++;
        }
        originalEnd.apply(this, args);
      };
      
      next();
    },
    
    getStats: () => ({
      uptime: Date.now() - startTime,
      requestCount,
      errorCount,
      errorRate: requestCount > 0 ? (errorCount / requestCount) * 100 : 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    })
  };
}

module.exports = {
  requestLogger,
  errorLogger,
  createHealthMonitor
}; 