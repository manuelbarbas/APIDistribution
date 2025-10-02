import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error details
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    body: req.body,
  });

  // Handle custom app errors
  if (err instanceof AppError) {
    const errorResponse: any = {
      message: err.message,
      statusCode: err.statusCode,
    };

    // Add specific error details
    if (err.name === 'ValidationError') {
      errorResponse.errors = (err as any).errors;
    }
    
    if (err.name === 'BlockchainError' && (err as any).txHash) {
      errorResponse.transactionHash = (err as any).txHash;
    }
    
    if (err.name === 'SufficientBalanceError') {
      const sufficientErr = err as any;
      if (sufficientErr.currentBalance) {
        errorResponse.currentBalance = sufficientErr.currentBalance;
      }
      if (sufficientErr.threshold) {
        errorResponse.threshold = sufficientErr.threshold;
      }
    }

    res.status(err.statusCode).json({
      success: false,
      error: errorResponse,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle unexpected errors
  const statusCode = 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Handle 404 errors
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.originalUrl} not found`,
      statusCode: 404,
    },
    timestamp: new Date().toISOString(),
  });
};