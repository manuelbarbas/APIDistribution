import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.config';
import gasRoutes from './routes/gas.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import logger from './utils/logger';

/**
 * Create and configure Express application
 */
export const createApp = (): Application => {
  const app = express();

  // Security middleware
  app.use(helmet());
  
  // CORS configuration
  app.use(cors({
    origin: config.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: config.MAX_REQUESTS_PER_MINUTE,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiting to all routes
  app.use('/api', limiter);

  // Request logging middleware
  app.use((req, res, next) => {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    next();
  });

  // API routes
  app.use('/api', gasRoutes);

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Gas Distribution API',
      version: '1.0.0',
      endpoints: {
        distribution: 'POST /api/fair/gas',
        health: 'GET /api/health',
        wallet: 'GET /api/wallet/info',
        balance: 'GET /api/balance/:address',
        estimate: 'POST /api/estimate',
        transaction: 'GET /api/transaction/:txHash',
      },
    });
  });

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};