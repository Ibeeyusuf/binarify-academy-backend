import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Import routes
import applicationRoutes from './routes/applicationRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js'; // ADD THIS
import dashboardRoutes from './routes/dashboardRoutes.js'
// Import middleware
import { requestLogger, applicationLogger } from './middleware/logger.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/binarify-academy', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

connectDB();

// Event listeners for MongoDB
mongoose.connection.on('error', err => {
  console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
  // Attempt to reconnect
  setTimeout(connectDB, 5000);
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com']
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl requests, or server-to-server)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',') 
      : ['http://localhost:3000', 'http://localhost:3000', 'http://localhost:3001'];
    
    // Check if origin is in allowed origins or if we're in development
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.error(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'x-paystack-signature' // ADD THIS FOR PAYSTACK WEBHOOK
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests for all routes
app.options('*', cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

// Webhook endpoint should NOT have rate limiting
app.use('/api/payments/webhook', (req, res, next) => {
  // Skip rate limiting for webhooks
  next();
});

// Apply rate limiting to other routes
app.use('/api/', limiter);

// Webhook body parser (MUST come before regular body parsers)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Other middleware
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

// Additional logging for development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(requestLogger);
app.use(applicationLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV,
    cors: {
      allowedOrigins: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:3000', 'http://localhost:3000', 'http://localhost:3001']
    },
    paystack: {
      configured: !!process.env.PAYSTACK_SECRET_KEY,
      mode: process.env.PAYSTACK_SECRET_KEY?.includes('test') ? 'test' : 'live'
    }
  };
  
  res.status(200).json(healthStatus);
});

// Test endpoint to verify CORS is working
app.get('/api/test-cors', (req, res) => {
  res.json({
    message: 'CORS is working!',
    origin: req.headers.origin,
    allowed: true
  });
});

// Paystack test endpoint
app.get('/api/payments/test', (req, res) => {
  const paystackStatus = {
    secret_key_configured: !!process.env.PAYSTACK_SECRET_KEY,
    public_key_configured: !!process.env.PAYSTACK_PUBLIC_KEY,
    webhook_secret_configured: !!process.env.PAYSTACK_WEBHOOK_SECRET,
    frontend_url: process.env.FRONTEND_URL,
    app_url: process.env.APP_URL,
    note: process.env.PAYSTACK_SECRET_KEY ? 
      'Paystack is configured' : 
      'Please add PAYSTACK_SECRET_KEY to .env file'
  };
  
  res.json(paystackStatus);
});

// API routes

app.use('/api/applications', applicationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);    
app.use('/api/dashboard', dashboardRoutes);
// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const optionalEnvVars = ['PAYSTACK_SECRET_KEY', 'PAYSTACK_PUBLIC_KEY', 'PAYSTACK_WEBHOOK_SECRET', 'FRONTEND_URL', 'APP_URL'];

console.log('\n=== Environment Variables Check ===');
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
  } else {
    console.log(`✅ ${varName}: ${varName.includes('SECRET') ? '****' + process.env[varName].slice(-4) : process.env[varName]}`);
  }
});

optionalEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.warn(`⚠️  Missing optional environment variable: ${varName}`);
  } else {
    console.log(`✅ ${varName}: ${varName.includes('SECRET') ? '****' + process.env[varName].slice(-4) : process.env[varName]}`);
  }
});
console.log('===================================\n');

const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`CORS enabled for origins: ${process.env.FRONTEND_URL || 'http://localhost:3000, http://localhost:3000, http://localhost:3001'}`);
  console.log(`Paystack mode: ${process.env.PAYSTACK_SECRET_KEY?.includes('test') ? 'TEST' : 'LIVE'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Test CORS: http://localhost:${PORT}/api/test-cors`);
  console.log(`Paystack test: http://localhost:${PORT}/api/payments/test`);
  console.log(`Backend ready for Paystack integration!`);
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('Received shutdown signal, closing server...');
  
  server.close(() => {
    console.log('HTTP server closed');
    
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default app;