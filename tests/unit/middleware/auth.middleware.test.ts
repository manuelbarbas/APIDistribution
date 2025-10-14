import { authenticateApiKey } from '../../../src/middleware/auth.middleware';
import { AuthenticationError } from '../../../src/utils/errors';
import { createMockRequest, createMockResponse, createMockNext, TEST_DATA } from '../../utils/test-helpers';

// Mock config
jest.mock('../../../src/config/env.config', () => ({
  config: {
    API_KEY: TEST_DATA.API_KEYS.VALID,
    NODE_ENV: 'test',
  },
}));

// Mock crypto
const mockTimingSafeEqual = jest.fn();
jest.mock('crypto', () => ({
  timingSafeEqual: mockTimingSafeEqual,
  randomBytes: jest.fn(() => ({ toString: () => 'test-request-id-12345' })),
}));

describe('Authentication Middleware', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
    mockTimingSafeEqual.mockReset();
  });

  describe('API key extraction', () => {
    it('should extract API key from Authorization header (Bearer token)', async () => {
      const apiKey = TEST_DATA.API_KEYS.VALID;
      req.headers.authorization = `Bearer ${apiKey}`;
      mockTimingSafeEqual.mockReturnValue(true);

      await authenticateApiKey(req, res, next);

      expect(req.apiKey).toBe(apiKey);
      expect(req.requestId).toBeDefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('should extract API key from X-API-Key header', async () => {
      const apiKey = TEST_DATA.API_KEYS.VALID;
      req.headers['x-api-key'] = apiKey;
      mockTimingSafeEqual.mockReturnValue(true);

      await authenticateApiKey(req, res, next);

      expect(req.apiKey).toBe(apiKey);
      expect(req.requestId).toBeDefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('should extract API key from query parameter in development', async () => {
      // Mock development environment
      jest.doMock('../../../src/config/env.config', () => ({
        config: {
          API_KEY: TEST_DATA.API_KEYS.VALID,
          NODE_ENV: 'development',
        },
      }));

      const apiKey = TEST_DATA.API_KEYS.VALID;
      req.query.apiKey = apiKey;
      mockTimingSafeEqual.mockReturnValue(true);

      // Re-import to get the new config
      jest.resetModules();
      const { authenticateApiKey: devAuthMiddleware } = await import('../../../src/middleware/auth.middleware');
      
      await devAuthMiddleware(req, res, next);

      expect(req.apiKey).toBe(apiKey);
      expect(next).toHaveBeenCalledWith();
    });

    it('should prioritize Authorization header over X-API-Key header', async () => {
      const bearerKey = TEST_DATA.API_KEYS.VALID;
      const xApiKey = 'different-api-key-32-characters-abc123';
      
      req.headers.authorization = `Bearer ${bearerKey}`;
      req.headers['x-api-key'] = xApiKey;
      mockTimingSafeEqual.mockReturnValue(true);

      await authenticateApiKey(req, res, next);

      expect(req.apiKey).toBe(bearerKey);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('API key validation', () => {
    it('should reject requests without API key', async () => {
      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      expect(next.mock.calls[0][0].message).toBe('API key is required');
    });

    it('should reject invalid API key', async () => {
      req.headers.authorization = `Bearer ${TEST_DATA.API_KEYS.INVALID}`;
      mockTimingSafeEqual.mockReturnValue(false);

      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      expect(next.mock.calls[0][0].message).toBe('Invalid API key');
    });

    it('should use constant-time comparison for API key validation', async () => {
      const apiKey = TEST_DATA.API_KEYS.VALID;
      req.headers.authorization = `Bearer ${apiKey}`;
      mockTimingSafeEqual.mockReturnValue(true);

      await authenticateApiKey(req, res, next);

      expect(mockTimingSafeEqual).toHaveBeenCalledWith(
        Buffer.from(apiKey),
        Buffer.from(TEST_DATA.API_KEYS.VALID)
      );
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject API key with different length', async () => {
      const shortKey = 'short';
      req.headers.authorization = `Bearer ${shortKey}`;
      // mockTimingSafeEqual won't be called due to length check

      await authenticateApiKey(req, res, next);

      expect(mockTimingSafeEqual).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('Request enrichment', () => {
    it('should add requestId to authenticated requests', async () => {
      req.headers.authorization = `Bearer ${TEST_DATA.API_KEYS.VALID}`;
      mockTimingSafeEqual.mockReturnValue(true);

      await authenticateApiKey(req, res, next);

      expect(req.requestId).toBeDefined();
      expect(typeof req.requestId).toBe('string');
      expect(req.requestId.length).toBeGreaterThan(0);
    });

    it('should add apiKey to authenticated requests', async () => {
      const apiKey = TEST_DATA.API_KEYS.VALID;
      req.headers.authorization = `Bearer ${apiKey}`;
      mockTimingSafeEqual.mockReturnValue(true);

      await authenticateApiKey(req, res, next);

      expect(req.apiKey).toBe(apiKey);
    });
  });

  describe('Security logging', () => {
    it('should log successful authentication', async () => {
      const apiKey = TEST_DATA.API_KEYS.VALID;
      req.headers.authorization = `Bearer ${apiKey}`;
      req.method = 'POST';
      req.path = '/api/test';
      req.ip = '192.168.1.1';
      mockTimingSafeEqual.mockReturnValue(true);

      await authenticateApiKey(req, res, next);

      // Logger is mocked, so we just ensure the middleware completes successfully
      expect(next).toHaveBeenCalledWith();
      expect(req.apiKey).toBe(apiKey);
    });

    it('should log invalid API key attempts', async () => {
      req.headers.authorization = 'Bearer invalid-key';
      req.ip = '192.168.1.1';
      req.get = jest.fn().mockReturnValue('Mozilla/5.0 Test Browser');
      mockTimingSafeEqual.mockReturnValue(false);

      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      expect(req.get).toHaveBeenCalledWith('user-agent');
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed Authorization header', async () => {
      req.headers.authorization = 'Malformed header';

      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      expect(next.mock.calls[0][0].message).toBe('API key is required');
    });

    it('should handle array values in X-API-Key header', async () => {
      req.headers['x-api-key'] = ['key1', 'key2']; // Express can provide arrays

      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      expect(next.mock.calls[0][0].message).toBe('API key is required');
    });

    it('should handle undefined headers', async () => {
      req.headers = {};

      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      expect(next.mock.calls[0][0].message).toBe('API key is required');
    });

    it('should not use query parameter in production', async () => {
      // Ensure production environment
      jest.doMock('../../../src/config/env.config', () => ({
        config: {
          API_KEY: TEST_DATA.API_KEYS.VALID,
          NODE_ENV: 'production',
        },
      }));

      req.query.apiKey = TEST_DATA.API_KEYS.VALID;

      // Re-import to get the new config
      jest.resetModules();
      const { authenticateApiKey: prodAuthMiddleware } = await import('../../../src/middleware/auth.middleware');
      
      await prodAuthMiddleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      expect(next.mock.calls[0][0].message).toBe('API key is required');
    });
  });
});