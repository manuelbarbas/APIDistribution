import {
  AppError,
  AuthenticationError,
  ValidationError,
  RateLimitError,
  BlockchainError,
  InsufficientBalanceError,
  SufficientBalanceError,
} from '../../../src/utils/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an AppError with correct properties', () => {
      const message = 'Test error message';
      const statusCode = 400;
      const error = new AppError(message, statusCode);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(statusCode);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('AppError');
    });

    it('should set isOperational to false when specified', () => {
      const error = new AppError('Test error', 500, false);
      expect(error.isOperational).toBe(false);
    });

    it('should have proper stack trace', () => {
      const error = new AppError('Test error', 500);
      expect(error.stack).toBeDefined();
    });
  });

  describe('AuthenticationError', () => {
    it('should create an AuthenticationError with default message', () => {
      const error = new AuthenticationError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Authentication failed');
      expect(error.statusCode).toBe(401);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('AuthenticationError');
    });

    it('should create an AuthenticationError with custom message', () => {
      const customMessage = 'Invalid API key';
      const error = new AuthenticationError(customMessage);

      expect(error.message).toBe(customMessage);
      expect(error.statusCode).toBe(401);
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError with default message', () => {
      const error = new ValidationError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('ValidationError');
      expect(error.errors).toBeUndefined();
    });

    it('should create a ValidationError with custom message and errors', () => {
      const customMessage = 'Form validation failed';
      const validationErrors = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too short' },
      ];
      const error = new ValidationError(customMessage, validationErrors);

      expect(error.message).toBe(customMessage);
      expect(error.statusCode).toBe(400);
      expect(error.errors).toEqual(validationErrors);
    });
  });

  describe('RateLimitError', () => {
    it('should create a RateLimitError with default message', () => {
      const error = new RateLimitError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toBe('Too many requests');
      expect(error.statusCode).toBe(429);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('RateLimitError');
    });

    it('should create a RateLimitError with custom message', () => {
      const customMessage = 'Rate limit exceeded for this endpoint';
      const error = new RateLimitError(customMessage);

      expect(error.message).toBe(customMessage);
      expect(error.statusCode).toBe(429);
    });
  });

  describe('BlockchainError', () => {
    it('should create a BlockchainError with message only', () => {
      const message = 'Transaction failed';
      const error = new BlockchainError(message);

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(BlockchainError);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('BlockchainError');
      expect(error.txHash).toBeUndefined();
    });

    it('should create a BlockchainError with message and transaction hash', () => {
      const message = 'Transaction failed';
      const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const error = new BlockchainError(message, txHash);

      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(500);
      expect(error.txHash).toBe(txHash);
    });
  });

  describe('InsufficientBalanceError', () => {
    it('should create an InsufficientBalanceError with default message', () => {
      const error = new InsufficientBalanceError();

      expect(error).toBeInstanceOf(BlockchainError);
      expect(error).toBeInstanceOf(InsufficientBalanceError);
      expect(error.message).toBe('Insufficient balance for gas distribution');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('InsufficientBalanceError');
    });

    it('should create an InsufficientBalanceError with custom message', () => {
      const customMessage = 'Not enough ETH in wallet';
      const error = new InsufficientBalanceError(customMessage);

      expect(error.message).toBe(customMessage);
      expect(error.statusCode).toBe(500);
    });
  });

  describe('SufficientBalanceError', () => {
    it('should create a SufficientBalanceError with default message', () => {
      const error = new SufficientBalanceError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(SufficientBalanceError);
      expect(error.message).toBe('You have enough sFUEL');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('SufficientBalanceError');
      expect(error.currentBalance).toBeUndefined();
      expect(error.threshold).toBeUndefined();
    });

    it('should create a SufficientBalanceError with custom message and balance info', () => {
      const customMessage = 'Wallet has sufficient funds';
      const currentBalance = '1.5';
      const threshold = '0.1';
      const error = new SufficientBalanceError(customMessage, currentBalance, threshold);

      expect(error.message).toBe(customMessage);
      expect(error.statusCode).toBe(400);
      expect(error.currentBalance).toBe(currentBalance);
      expect(error.threshold).toBe(threshold);
    });
  });

  describe('Error inheritance chain', () => {
    it('should maintain proper inheritance for AuthenticationError', () => {
      const error = new AuthenticationError();
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof AuthenticationError).toBe(true);
    });

    it('should maintain proper inheritance for ValidationError', () => {
      const error = new ValidationError();
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof ValidationError).toBe(true);
    });

    it('should maintain proper inheritance for BlockchainError', () => {
      const error = new BlockchainError('Test');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof BlockchainError).toBe(true);
    });

    it('should maintain proper inheritance for InsufficientBalanceError', () => {
      const error = new InsufficientBalanceError();
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof BlockchainError).toBe(true);
      expect(error instanceof InsufficientBalanceError).toBe(true);
    });

    it('should maintain proper inheritance for SufficientBalanceError', () => {
      const error = new SufficientBalanceError();
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof SufficientBalanceError).toBe(true);
      // Note: SufficientBalanceError extends AppError directly, not BlockchainError
      expect(error instanceof BlockchainError).toBe(false);
    });
  });

  describe('Error serialization', () => {
    it('should be JSON serializable', () => {
      const error = new ValidationError('Test validation error', [
        { field: 'test', message: 'test error' }
      ]);

      const serialized = JSON.stringify(error);
      expect(serialized).toBeDefined();
      
      const parsed = JSON.parse(serialized);
      expect(parsed.message).toBe(error.message);
      expect(parsed.statusCode).toBe(error.statusCode);
      expect(parsed.errors).toEqual(error.errors);
    });

    it('should handle complex error data', () => {
      const txHash = '0x1234567890abcdef';
      const error = new BlockchainError('Transaction failed on chain', txHash);

      const serialized = JSON.stringify(error);
      const parsed = JSON.parse(serialized);
      
      expect(parsed.message).toBe(error.message);
      expect(parsed.statusCode).toBe(error.statusCode);
      expect(parsed.txHash).toBe(error.txHash);
    });
  });
});