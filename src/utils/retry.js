const logger = require('../config/logger');

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.baseDelay - Base delay in milliseconds (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 10000)
 * @param {string} options.operation - Operation name for logging
 * @returns {Promise} - Result of the function
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    operation = 'operation'
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await fn();
      
      if (attempt > 1) {
        logger.info(`✅ ${operation} succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      if (attempt <= maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        logger.warn(`❌ ${operation} failed on attempt ${attempt}/${maxRetries + 1}: ${error.message}`);
        logger.info(`⏳ Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.error(`💥 ${operation} failed after ${maxRetries + 1} attempts`);
      }
    }
  }
  
  throw lastError;
}

/**
 * Retry database operations specifically
 * @param {Function} fn - Database function to retry
 * @param {string} operation - Operation name for logging
 * @returns {Promise} - Result of the function
 */
async function retryDatabaseOperation(fn, operation = 'database operation') {
  return retryWithBackoff(fn, {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    operation
  });
}

module.exports = {
  retryWithBackoff,
  retryDatabaseOperation
}; 