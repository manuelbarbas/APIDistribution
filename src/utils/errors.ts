/**
 * Base error class for API errors
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  public readonly errors?: any[];

  constructor(message = 'Validation failed', errors?: any[]) {
    super(message, 400);
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Blockchain error
 */
export class BlockchainError extends AppError {
  public readonly txHash?: string;

  constructor(message: string, txHash?: string) {
    super(message, 500);
    this.txHash = txHash;
    Object.setPrototypeOf(this, BlockchainError.prototype);
  }
}

/**
 * Insufficient balance error
 */
export class InsufficientBalanceError extends BlockchainError {
  constructor(message = 'Insufficient balance for gas distribution') {
    super(message);
    Object.setPrototypeOf(this, InsufficientBalanceError.prototype);
  }
}

/**
 * Sufficient balance error - recipient already has enough gas
 */
export class SufficientBalanceError extends AppError {
  public readonly currentBalance?: string;
  public readonly threshold?: string;

  constructor(
    message = 'You have enough sFUEL', 
    currentBalance?: string, 
    threshold?: string
  ) {
    super(message, 400); // 400 Bad Request since it's a client error
    this.currentBalance = currentBalance;
    this.threshold = threshold;
    Object.setPrototypeOf(this, SufficientBalanceError.prototype);
  }
}
