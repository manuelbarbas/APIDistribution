import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../src/types';

/**
 * Create a mock Express request object
 */
export const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  method: 'POST',
  path: '/api/fair/gas',
  body: {},
  headers: {},
  ip: '127.0.0.1',
  get: jest.fn(),
  query: {},
  params: {},
  originalUrl: '/api/fair/gas',
  ...overrides,
});

/**
 * Create a mock authenticated request object
 */
export const createMockAuthenticatedRequest = (
  overrides: Partial<AuthenticatedRequest> = {}
): Partial<AuthenticatedRequest> => ({
  ...createMockRequest(),
  apiKey: 'test-api-key-32-characters-long-abc123',
  requestId: 'test-request-id-12345',
  ...overrides,
});

/**
 * Create a mock Express response object
 */
export const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    getHeader: jest.fn(),
  };
  return res;
};

/**
 * Create a mock Next function
 */
export const createMockNext = (): jest.Mock => jest.fn();

/**
 * Common test data
 */
export const TEST_DATA = {
  ADDRESSES: {
    VALID: '0x742d35Cc6506C5b5b60c96b1c32B6C1e83aA0aEb',
    VALID_2: '0x1234567890123456789012345678901234567890',
    INVALID: '0xinvalid',
    INVALID_LENGTH: '0x123',
    ZERO: '0x0000000000000000000000000000000000000000',
  },
  PRIVATE_KEYS: {
    VALID: '0x1234567890123456789012345678901234567890123456789012345678901234',
    INVALID: '0x123',
  },
  API_KEYS: {
    VALID: 'test-api-key-32-characters-long-abc123',
    INVALID: 'short',
  },
  AMOUNTS: {
    VALID: '0.1',
    ZERO: '0',
    NEGATIVE: '-0.1',
    TOO_LARGE: '11',
  },
  TRANSACTION_HASHES: {
    VALID: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    INVALID: '0x123',
  },
  BALANCES: {
    LOW: BigInt('1000000000000000'), // 0.001 ETH
    MEDIUM: BigInt('100000000000000000'), // 0.1 ETH
    HIGH: BigInt('1000000000000000000'), // 1 ETH
  },
};

/**
 * Wait helper for async tests
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Environment variable backup and restore utilities
 */
export const envUtils = {
  backup: {} as Record<string, string | undefined>,
  
  saveEnv(keys: string[]): void {
    keys.forEach(key => {
      this.backup[key] = process.env[key];
    });
  },
  
  restoreEnv(keys: string[]): void {
    keys.forEach(key => {
      if (this.backup[key] !== undefined) {
        process.env[key] = this.backup[key];
      } else {
        delete process.env[key];
      }
    });
  },
  
  setEnv(env: Record<string, string>): void {
    Object.entries(env).forEach(([key, value]) => {
      process.env[key] = value;
    });
  },
};