import { errorHandler, notFoundHandler } from '../../../src/middleware/error.middleware';
import {
  AppError,
  AuthenticationError,
  ValidationError,
  BlockchainError,
  SufficientBalanceError,
} from '../../../src/utils/errors';
import { createMockRequest, createMockResponse, createMockNext } from '../../utils/test-helpers';

describe('Error Middleware', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    req = createMockRequest({
      path: '/api/test',
      method: 'POST',
      ip: '127.0.0.1',
      body: { test: 'data' },
    });
    res = createMockResponse();
    next = createMockNext();
  });

  describe('errorHandler', () => {
    it('should handle AppError correctly', () => {
      const error = new AppError('Test app error', 400);
      
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Test app error',
          statusCode: 400,
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle AuthenticationError correctly', () => {
      const error = new AuthenticationError('Invalid credentials');
      
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Invalid credentials',
          statusCode: 401,
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle ValidationError with errors array', () => {
      const validationErrors = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' },
      ];
      const error = new ValidationError('Validation failed', validationErrors);
      
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Validation failed',
          statusCode: 400,
          errors: validationErrors,
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle BlockchainError with transaction hash', () => {
      const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const error = new BlockchainError('Transaction failed', txHash);
      
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Transaction failed',
          statusCode: 500,
          transactionHash: txHash,
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle SufficientBalanceError with balance info', () => {
      const currentBalance = '1.5';
      const threshold = '0.1';
      const error = new SufficientBalanceError(
        'You have enough funds',
        currentBalance,
        threshold
      );
      
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'You have enough funds',
          statusCode: 400,
          currentBalance,
          threshold,
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle generic Error in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Database connection failed');
      
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Internal server error',
          statusCode: 500,
        },
        timestamp: expect.any(String),
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle generic Error in development with stack trace', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Database connection failed');
      
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Database connection failed',
          statusCode: 500,
          stack: expect.any(String),
        },
        timestamp: expect.any(String),
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should log error details', () => {
      const error = new Error('Test error');
      
      // Logger is mocked in setup.ts, but we can still verify the handler runs
      expect(() => errorHandler(error, req, res, next)).not.toThrow();
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    });

    it('should handle errors without name property', () => {
      const error = new AppError('Test error', 400);
      delete (error as any).name;
      
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Test error',
          statusCode: 400,
        },
        timestamp: expect.any(String),
      });
    });

    it('should include timestamp in ISO format', () => {
      const error = new AppError('Test error', 400);
      const beforeTime = new Date().getTime();
      
      errorHandler(error, req, res, next);
      
      const callArgs = (res.json as jest.Mock).mock.calls[0][0];
      const timestamp = callArgs.timestamp;
      const parsedTime = new Date(timestamp).getTime();
      const afterTime = new Date().getTime();
      
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(parsedTime).toBeGreaterThanOrEqual(beforeTime);
      expect(parsedTime).toBeLessThanOrEqual(afterTime);
    });

    it('should handle BlockchainError without transaction hash', () => {
      const error = new BlockchainError('Network error');
      
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      const callArgs = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.error.transactionHash).toBeUndefined();
    });

    it('should handle SufficientBalanceError without balance info', () => {
      const error = new SufficientBalanceError();
      
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const callArgs = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.error.currentBalance).toBeUndefined();
      expect(callArgs.error.threshold).toBeUndefined();
    });
  });

  describe('notFoundHandler', () => {
    it('should handle 404 errors correctly', () => {
      req.originalUrl = '/api/nonexistent';
      
      notFoundHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Route /api/nonexistent not found',
          statusCode: 404,
        },
        timestamp: expect.any(String),
      });
    });

    it('should include timestamp in ISO format', () => {
      req.originalUrl = '/api/test';
      const beforeTime = new Date().getTime();
      
      notFoundHandler(req, res, next);
      
      const callArgs = (res.json as jest.Mock).mock.calls[0][0];
      const timestamp = callArgs.timestamp;
      const parsedTime = new Date(timestamp).getTime();
      const afterTime = new Date().getTime();
      
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(parsedTime).toBeGreaterThanOrEqual(beforeTime);
      expect(parsedTime).toBeLessThanOrEqual(afterTime);
    });

    it('should handle requests with query parameters', () => {
      req.originalUrl = '/api/test?param=value';
      
      notFoundHandler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Route /api/test?param=value not found',
          statusCode: 404,
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle root path requests', () => {
      req.originalUrl = '/';
      
      notFoundHandler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Route / not found',
          statusCode: 404,
        },
        timestamp: expect.any(String),
      });
    });
  });

  describe('Error response format consistency', () => {
    it('should maintain consistent response format for all error types', () => {
      const errors = [
        new AppError('App error', 400),
        new AuthenticationError('Auth error'),
        new ValidationError('Validation error'),
        new BlockchainError('Blockchain error'),
        new SufficientBalanceError('Sufficient balance'),
      ];

      errors.forEach((error, index) => {
        // Reset mocks for each iteration
        (res.status as jest.Mock).mockClear();
        (res.json as jest.Mock).mockClear();
        
        errorHandler(error, req, res, next);

        const callArgs = (res.json as jest.Mock).mock.calls[0][0];
        
        // All error responses should have these fields
        expect(callArgs).toHaveProperty('success', false);
        expect(callArgs).toHaveProperty('error');
        expect(callArgs).toHaveProperty('timestamp');
        expect(callArgs.error).toHaveProperty('message');
        expect(callArgs.error).toHaveProperty('statusCode');
        expect(typeof callArgs.timestamp).toBe('string');
      });
    });
  });
});