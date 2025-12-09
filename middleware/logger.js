import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Request logger
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log after response is sent
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const log = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?._id || 'anonymous'
    };

    // Console log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`${log.timestamp} ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    }

    // File logging
    const logMessage = `${log.timestamp} - ${log.method} ${log.url} - Status: ${log.status} - Duration: ${log.duration} - IP: ${log.ip} - User: ${log.userId}\n`;
    
    fs.appendFile(
      path.join(logsDir, 'requests.log'),
      logMessage,
      (err) => {
        if (err) console.error('Error writing to log file:', err);
      }
    );

    // Log errors separately
    if (res.statusCode >= 400) {
      const errorLog = {
        ...log,
        body: req.body,
        params: req.params,
        query: req.query,
        error: res.locals.errorMessage
      };

      fs.appendFile(
        path.join(logsDir, 'errors.log'),
        JSON.stringify(errorLog) + '\n',
        (err) => {
          if (err) console.error('Error writing to error log:', err);
        }
      );
    }
  });

  next();
};

// Application-specific logging
export const applicationLogger = (req, res, next) => {
  const originalSend = res.json;
  
  res.json = function(data) {
    // Log application submissions
    if (req.path.includes('/applications/submit') && req.method === 'POST') {
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'application_submission',
        data: {
          email: req.body.email,
          track: req.body.track,
          program: req.body.program,
          country: req.body.country,
          ip: req.ip,
          success: data.success,
          applicationId: data.data?.id
        }
      };

      fs.appendFile(
        path.join(logsDir, 'applications.log'),
        JSON.stringify(logEntry) + '\n',
        (err) => {
          if (err) console.error('Error writing application log:', err);
        }
      );
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};