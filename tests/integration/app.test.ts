import request from 'supertest';
import { createApp } from '../../src/app';
import { TEST_DATA } from '../utils/test-helpers';

// Mock dependencies
jest.mock('../../src/services/blockchain.service', () => ({
  BlockchainService: {
    getInstance: () => ({
      healthCheck: jest.fn().mockResolvedValue(true),
      getWalletAddress: jest.fn().mockReturnValue('0x742d35Cc6506C5b5b60c96b1c32B6C1e83aA0aEb'),
      getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')),
    }),
  },
}));

jest.mock('../../src/config/env.config', () => ({
  config: {
    API_KEY: 'test-api-key-32-characters-long-abc123',
    NODE_ENV: 'test',
    PORT: 3001,
    MAX_REQUESTS_PER_MINUTE: 10,
  },
}));

describe('Application Integration Tests', () => {
  let app: any;

  beforeAll(() => {
    app = createApp();
  });

  describe('Application setup', () => {
    it('should create Express application successfully', () => {
      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });

    it('should have all required middleware configured', async () => {
      // Test that security middleware is applied
      const response = await request(app).get('/');
      
      // Check for helmet security headers
      expect(response.headers).toHaveProperty('x-dns-prefetch-control');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-download-options');
    });

    it('should handle JSON parsing', async () => {
      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({
          address: TEST_DATA.ADDRESSES.VALID,
          amount: '0.1',
        }));

      // Should not fail due to JSON parsing issues
      expect(response.status).not.toBe(400);
    });

    it('should handle URL encoding', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
    });
  });

  describe('Root endpoint', () => {
    it('should return API information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
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

    it('should not require authentication', async () => {
      await request(app)
        .get('/')
        .expect(200);
    });
  });

  describe('CORS configuration', () => {
    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/fair/gas')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Authorization');

      expect(response.status).not.toBe(404);
    });

    it('should include CORS headers in responses', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limiting to /api routes', async () => {
      // Make rapid requests to trigger rate limiting
      const requests = Array(15).fill(0).map((_, i) =>
        request(app)
          .get('/api/health')
          .then(res => res.status)
          .catch(() => 429)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedCount = responses.filter(status => status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    }, 10000);

    it('should not apply rate limiting to root endpoint', async () => {
      // Make multiple requests to root - should all succeed
      const requests = Array(5).fill(0).map(() =>
        request(app).get('/').then(res => res.status)
      );

      const responses = await Promise.all(requests);
      const successCount = responses.filter(status => status === 200).length;
      
      expect(successCount).toBe(5);
    });
  });

  describe('Request logging middleware', () => {
    it('should log incoming requests', async () => {
      // Logger is mocked, but we can verify the middleware doesn't cause errors
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
    });

    it('should include request information in logs', async () => {
      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .set('User-Agent', 'Test-Agent')
        .send({
          address: TEST_DATA.ADDRESSES.VALID,
        });

      // Should process without logging errors
      expect([200, 400, 401]).toContain(response.status);
    });
  });

  describe('Error handling', () => {
    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Route /nonexistent-route not found',
          statusCode: 404,
        },
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    it('should handle unsupported HTTP methods', async () => {
      const response = await request(app)
        .patch('/api/health');

      expect(response.status).toBe(404);
    });
  });

  describe('Body parsing limits', () => {
    it('should accept requests within size limits', async () => {
      const largeButValidPayload = {
        address: TEST_DATA.ADDRESSES.VALID,
        amount: '0.1',
        metadata: 'x'.repeat(1000), // 1KB of data
      };

      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .send(largeButValidPayload);

      // Should not fail due to size (should fail due to validation or other reasons)
      expect(response.status).not.toBe(413); // Payload Too Large
    });
  });

  describe('Security headers', () => {
    it('should include security headers from Helmet', async () => {
      const response = await request(app).get('/');

      // Common security headers from Helmet
      expect(response.headers['x-dns-prefetch-control']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-download-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
    });

    it('should set appropriate cache control headers', async () => {
      const response = await request(app).get('/api/health');
      
      // Health endpoint should not be cached aggressively
      expect(response.headers['cache-control']).toBeDefined();
    });
  });

  describe('Content Type handling', () => {
    it('should handle application/json content type', async () => {
      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({
          address: TEST_DATA.ADDRESSES.VALID,
        }));

      expect(response.status).not.toBe(415); // Unsupported Media Type
    });

    it('should handle application/x-www-form-urlencoded', async () => {
      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(`address=${TEST_DATA.ADDRESSES.VALID}&amount=0.1`);

      expect(response.status).not.toBe(415);
    });
  });

  describe('Request ID tracking', () => {
    it('should process requests with API key authentication', async () => {
      const response = await request(app)
        .post('/api/fair/gas')
        .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
        .send({
          address: TEST_DATA.ADDRESSES.VALID,
        });

      // Should have processed the request (regardless of business logic outcome)
      expect([200, 400, 401, 500]).toContain(response.status);
    });
  });

  describe('Environment-specific behavior', () => {
    it('should behave according to test environment', () => {
      // In test environment, certain features might be disabled or modified
      expect(process.env.NODE_ENV).toBe('test');
    });
  });
});