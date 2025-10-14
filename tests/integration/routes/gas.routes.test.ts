import request from 'supertest';
import { createApp } from '../../../src/app';
import { BlockchainService } from '../../../src/services/blockchain.service';
import { TEST_DATA } from '../../utils/test-helpers';
import { SufficientBalanceError, InsufficientBalanceError, BlockchainError } from '../../../src/utils/errors';

// Mock BlockchainService
const mockBlockchainService = {
  getInstance: jest.fn(),
  distributeGas: jest.fn(),
  getWalletAddress: jest.fn(),
  getBalance: jest.fn(),
  isValidAddress: jest.fn(),
  getRecipientBalance: jest.fn(),
  estimateGas: jest.fn(),
  getGasPrice: jest.fn(),
  getTransaction: jest.fn(),
  healthCheck: jest.fn(),
};

jest.mock('../../../src/services/blockchain.service', () => ({
  BlockchainService: {
    getInstance: () => mockBlockchainService,
  },
}));

// Mock ethers
jest.mock('ethers', () => ({
  formatEther: jest.fn((value: bigint) => (Number(value) / 1e18).toString()),
  formatUnits: jest.fn((value: bigint, unit: string) => {
    const divisor = unit === 'gwei' ? 1e9 : 1e18;
    return (Number(value) / divisor).toString();
  }),
  isAddress: jest.fn((address: string) => {
    return typeof address === 'string' && address.length === 42 && address.startsWith('0x');
  }),
}));

// Mock config
jest.mock('../../../src/config/env.config', () => ({
  config: {
    API_KEY: 'test-api-key-32-characters-long-abc123',
    NODE_ENV: 'test',
    PORT: 3001,
    MAX_REQUESTS_PER_MINUTE: 10,
  },
}));

describe('Gas Routes Integration Tests', () => {
  let app: any;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockBlockchainService.getWalletAddress.mockReturnValue(TEST_DATA.ADDRESSES.VALID);
    mockBlockchainService.isValidAddress.mockImplementation((address: string) => 
      address.length === 42 && address.startsWith('0x')
    );
  });

  describe('POST /api/fair/gas', () => {
    const validRequestBody = {
      address: TEST_DATA.ADDRESSES.VALID_2,
      amount: TEST_DATA.AMOUNTS.VALID,
    };

    const validTransactionInfo = {
      hash: TEST_DATA.TRANSACTION_HASHES.VALID,
      from: TEST_DATA.ADDRESSES.VALID,
      to: TEST_DATA.ADDRESSES.VALID_2,
      value: '100000000000000000', // 0.1 ETH in wei
      gasUsed: '21000',
      status: true,
      blockNumber: 12345,
      timestamp: new Date(),
    };

    it('should distribute gas successfully with valid API key', async () => {
      mockBlockchainService.distributeGas.mockResolvedValue(validTransactionInfo);

      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .send(validRequestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        transactionHash: validTransactionInfo.hash,
        recipient: validRequestBody.address,
        amount: '0.1',
        message: 'Gas distribution successful',
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('should distribute gas successfully with X-API-Key header', async () => {
      mockBlockchainService.distributeGas.mockResolvedValue(validTransactionInfo);

      const response = await request(app)
        .post('/api/fair/gas')
        .set('X-API-Key', TEST_DATA.API_KEYS.VALID)
        .send(validRequestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject request without API key', async () => {
      const response = await request(app)
        .post('/api/fair/gas')
        .send(validRequestBody)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('API key is required');
    });

    it('should reject request with invalid API key', async () => {
      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.INVALID}`)
        .send(validRequestBody)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid API key');
    });

    it('should validate request body - missing address', async () => {
      const invalidBody = { amount: TEST_DATA.AMOUNTS.VALID };

      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .send(invalidBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Validation failed');
      expect(response.body.error.errors).toHaveLength(1);
    });

    it('should validate request body - invalid address format', async () => {
      const invalidBody = {
        address: TEST_DATA.ADDRESSES.INVALID,
        amount: TEST_DATA.AMOUNTS.VALID,
      };

      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .send(invalidBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.errors.some((e: any) => 
        e.message === 'Invalid Ethereum address format'
      )).toBe(true);
    });

    it('should validate request body - invalid amount', async () => {
      const invalidBody = {
        address: TEST_DATA.ADDRESSES.VALID_2,
        amount: TEST_DATA.AMOUNTS.TOO_LARGE,
      };

      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .send(invalidBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.errors.some((e: any) => 
        e.message === 'Amount must be a positive number and not exceed 10'
      )).toBe(true);
    });

    it('should handle SufficientBalanceError', async () => {
      const error = new SufficientBalanceError('You have enough sFUEL', '1.0', '0.005');
      mockBlockchainService.distributeGas.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .send(validRequestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('You have enough sFUEL');
      expect(response.body.error.currentBalance).toBe('1.0');
      expect(response.body.error.threshold).toBe('0.005');
    });

    it('should handle InsufficientBalanceError', async () => {
      const error = new InsufficientBalanceError('Wallet has insufficient balance');
      mockBlockchainService.distributeGas.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .send(validRequestBody)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Wallet has insufficient balance');
    });

    it('should handle BlockchainError', async () => {
      const error = new BlockchainError('Transaction failed', TEST_DATA.TRANSACTION_HASHES.VALID);
      mockBlockchainService.distributeGas.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .send(validRequestBody)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Transaction failed');
      expect(response.body.error.transactionHash).toBe(TEST_DATA.TRANSACTION_HASHES.VALID);
    });

    it('should work without amount parameter', async () => {
      mockBlockchainService.distributeGas.mockResolvedValue(validTransactionInfo);
      const requestWithoutAmount = { address: TEST_DATA.ADDRESSES.VALID_2 };

      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .send(requestWithoutAmount)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      mockBlockchainService.healthCheck.mockResolvedValue(true);
      mockBlockchainService.getBalance.mockResolvedValue(TEST_DATA.BALANCES.HIGH);

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        status: 'healthy',
        service: 'gas-distribution-api',
        blockchain: {
          connected: true,
          network: 'FAIR Testnet',
          chainId: 935,
          walletAddress: TEST_DATA.ADDRESSES.VALID,
          walletBalance: '1',
        },
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return unhealthy status when blockchain is not accessible', async () => {
      mockBlockchainService.healthCheck.mockResolvedValue(false);
      mockBlockchainService.getBalance.mockResolvedValue(TEST_DATA.BALANCES.HIGH);

      const response = await request(app)
        .get('/api/health')
        .expect(503);

      expect(response.body).toMatchObject({
        success: false,
        status: 'unhealthy',
        blockchain: {
          connected: false,
        },
      });
    });

    it('should not require authentication', async () => {
      mockBlockchainService.healthCheck.mockResolvedValue(true);
      mockBlockchainService.getBalance.mockResolvedValue(TEST_DATA.BALANCES.HIGH);

      await request(app)
        .get('/api/health')
        .expect(200);
    });
  });

  describe('GET /api/balance/:address', () => {
    it('should return recipient balance with valid API key', async () => {
      const balance = TEST_DATA.BALANCES.MEDIUM;
      mockBlockchainService.getRecipientBalance.mockResolvedValue(balance);

      const response = await request(app)
        .get(`/api/balance/${TEST_DATA.ADDRESSES.VALID}`)
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        address: TEST_DATA.ADDRESSES.VALID,
        balance: '0.1',
        currency: 'FAIR',
      });
    });

    it('should reject request without API key', async () => {
      await request(app)
        .get(`/api/balance/${TEST_DATA.ADDRESSES.VALID}`)
        .expect(401);
    });

    it('should reject invalid address format', async () => {
      mockBlockchainService.isValidAddress.mockReturnValue(false);

      const response = await request(app)
        .get(`/api/balance/${TEST_DATA.ADDRESSES.INVALID}`)
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid address format');
    });
  });

  describe('POST /api/estimate', () => {
    it('should return gas estimation with valid API key', async () => {
      const gasEstimate = BigInt(21000);
      const gasPrice = BigInt('2000000000'); // 2 gwei
      mockBlockchainService.estimateGas.mockResolvedValue(gasEstimate);
      mockBlockchainService.getGasPrice.mockResolvedValue(gasPrice);

      const requestBody = {
        address: TEST_DATA.ADDRESSES.VALID,
        amount: TEST_DATA.AMOUNTS.VALID,
      };

      const response = await request(app)
        .post('/api/estimate')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        estimation: {
          gasLimit: '21000',
          gasPrice: '2',
          totalCost: '0.000042',
          currency: 'FAIR',
        },
      });
    });

    it('should reject request without API key', async () => {
      const requestBody = {
        address: TEST_DATA.ADDRESSES.VALID,
        amount: TEST_DATA.AMOUNTS.VALID,
      };

      await request(app)
        .post('/api/estimate')
        .send(requestBody)
        .expect(401);
    });

    it('should reject invalid address format', async () => {
      mockBlockchainService.isValidAddress.mockReturnValue(false);

      const requestBody = {
        address: TEST_DATA.ADDRESSES.INVALID,
        amount: TEST_DATA.AMOUNTS.VALID,
      };

      const response = await request(app)
        .post('/api/estimate')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid address format');
    });
  });

  describe('Rate limiting', () => {
    beforeEach(() => {
      // Mock successful operation for rate limiting tests
      mockBlockchainService.distributeGas.mockResolvedValue({
        hash: TEST_DATA.TRANSACTION_HASHES.VALID,
        from: TEST_DATA.ADDRESSES.VALID,
        to: TEST_DATA.ADDRESSES.VALID_2,
        value: '100000000000000000',
        timestamp: new Date(),
      });
    });

    it('should apply rate limiting to API endpoints', async () => {
      // This test might be flaky due to rate limiter timing
      // Make multiple requests rapidly
      const requests = Array(12).fill(0).map(() =>
        request(app)
          .post('/api/fair/gas')
          .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
          .send({
            address: TEST_DATA.ADDRESSES.VALID_2,
            amount: TEST_DATA.AMOUNTS.VALID,
          })
      );

      const responses = await Promise.all(requests.map(req => 
        req.then(res => res.status).catch(err => err.status)
      ));

      // Some requests should be rate limited (429)
      const rateLimitedCount = responses.filter(status => status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    }, 10000); // Increase timeout for this test
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Route /api/unknown-route not found');
    });
  });

  describe('CORS and security headers', () => {
    it('should include security headers', async () => {
      mockBlockchainService.healthCheck.mockResolvedValue(true);
      mockBlockchainService.getBalance.mockResolvedValue(TEST_DATA.BALANCES.HIGH);

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Check for helmet security headers
      expect(response.headers['x-dns-prefetch-control']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-download-options']).toBeDefined();
    });
  });

  describe('Request body size limits', () => {
    it('should accept normal-sized request bodies', async () => {
      mockBlockchainService.distributeGas.mockResolvedValue({
        hash: TEST_DATA.TRANSACTION_HASHES.VALID,
        from: TEST_DATA.ADDRESSES.VALID,
        to: TEST_DATA.ADDRESSES.VALID_2,
        value: '100000000000000000',
        timestamp: new Date(),
      });

      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .send({
          address: TEST_DATA.ADDRESSES.VALID_2,
          amount: TEST_DATA.AMOUNTS.VALID,
          // Add some extra data to test body parsing
          metadata: 'some additional data',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Content-Type handling', () => {
    it('should handle JSON content type', async () => {
      mockBlockchainService.distributeGas.mockResolvedValue({
        hash: TEST_DATA.TRANSACTION_HASHES.VALID,
        from: TEST_DATA.ADDRESSES.VALID,
        to: TEST_DATA.ADDRESSES.VALID_2,
        value: '100000000000000000',
        timestamp: new Date(),
      });

      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({
          address: TEST_DATA.ADDRESSES.VALID_2,
          amount: TEST_DATA.AMOUNTS.VALID,
        }))
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});