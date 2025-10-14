import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.API_KEY = 'test-api-key-32-characters-long-abc123';
process.env.PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
process.env.RPC_URL = 'https://test-rpc.example.com/';
process.env.CHAIN_ID = '31337'; // Hardhat network
process.env.GAS_AMOUNT = '0.1';
process.env.MINIMUM_BALANCE_THRESHOLD = '0.005';
process.env.MAX_REQUESTS_PER_MINUTE = '10';
process.env.MAX_REQUESTS_PER_DAY = '100';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests

// Mock winston logger to avoid console output during tests
jest.mock('winston', () => ({
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    errors: jest.fn(),
  },
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Global test timeout
jest.setTimeout(10000);