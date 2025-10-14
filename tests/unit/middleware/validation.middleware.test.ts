import { validate, gasDistributionSchema, paginationSchema } from '../../../src/middleware/validation.middleware';
import { ValidationError } from '../../../src/utils/errors';
import { createMockRequest, createMockResponse, createMockNext, TEST_DATA } from '../../utils/test-helpers';
import { z } from 'zod';

// Mock ethers isAddress function
jest.mock('ethers', () => ({
  isAddress: jest.fn((address: string) => {
    return typeof address === 'string' && address.length === 42 && address.startsWith('0x');
  }),
}));

describe('Validation Middleware', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
  });

  describe('validate function', () => {
    const simpleSchema = z.object({
      name: z.string().min(1),
      age: z.number().min(0),
    });

    it('should validate valid data and call next', async () => {
      const middleware = validate(simpleSchema);
      req.body = { name: 'John', age: 25 };

      await middleware(req, res, next);

      expect(req.body).toEqual({ name: 'John', age: 25 });
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject invalid data and call next with ValidationError', async () => {
      const middleware = validate(simpleSchema);
      req.body = { name: '', age: -5 };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('Validation failed');
      expect(error.errors).toBeDefined();
      expect(error.errors).toHaveLength(2);
    });

    it('should transform data according to schema', async () => {
      const transformSchema = z.object({
        count: z.string().transform((val) => parseInt(val, 10)),
      });
      const middleware = validate(transformSchema);
      req.body = { count: '42' };

      await middleware(req, res, next);

      expect(req.body).toEqual({ count: 42 });
      expect(next).toHaveBeenCalledWith();
    });

    it('should handle schema parsing errors', async () => {
      const middleware = validate(simpleSchema);
      req.body = { name: 123, age: 'invalid' }; // Wrong types

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.errors).toBeDefined();
      expect(error.errors.length).toBeGreaterThan(0);
    });
  });

  describe('gasDistributionSchema', () => {
    it('should validate valid gas distribution request', async () => {
      const middleware = validate(gasDistributionSchema);
      req.body = {
        address: TEST_DATA.ADDRESSES.VALID,
        amount: TEST_DATA.AMOUNTS.VALID,
      };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body.address).toBe(TEST_DATA.ADDRESSES.VALID);
      expect(req.body.amount).toBe(TEST_DATA.AMOUNTS.VALID);
    });

    it('should validate request without amount field', async () => {
      const middleware = validate(gasDistributionSchema);
      req.body = {
        address: TEST_DATA.ADDRESSES.VALID,
      };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body.address).toBe(TEST_DATA.ADDRESSES.VALID);
      expect(req.body.amount).toBeUndefined();
    });

    it('should reject empty address', async () => {
      const middleware = validate(gasDistributionSchema);
      req.body = {
        address: '',
        amount: TEST_DATA.AMOUNTS.VALID,
      };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.errors.some((e: any) => e.message === 'Address is required')).toBe(true);
    });

    it('should reject invalid address format', async () => {
      const middleware = validate(gasDistributionSchema);
      req.body = {
        address: TEST_DATA.ADDRESSES.INVALID,
        amount: TEST_DATA.AMOUNTS.VALID,
      };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.errors.some((e: any) => e.message === 'Invalid Ethereum address format')).toBe(true);
    });

    it('should reject zero amount', async () => {
      const middleware = validate(gasDistributionSchema);
      req.body = {
        address: TEST_DATA.ADDRESSES.VALID,
        amount: TEST_DATA.AMOUNTS.ZERO,
      };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.errors.some((e: any) => e.message === 'Amount must be a positive number and not exceed 10')).toBe(true);
    });

    it('should reject negative amount', async () => {
      const middleware = validate(gasDistributionSchema);
      req.body = {
        address: TEST_DATA.ADDRESSES.VALID,
        amount: TEST_DATA.AMOUNTS.NEGATIVE,
      };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.errors.some((e: any) => e.message === 'Amount must be a positive number and not exceed 10')).toBe(true);
    });

    it('should reject amount exceeding maximum', async () => {
      const middleware = validate(gasDistributionSchema);
      req.body = {
        address: TEST_DATA.ADDRESSES.VALID,
        amount: TEST_DATA.AMOUNTS.TOO_LARGE,
      };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.errors.some((e: any) => e.message === 'Amount must be a positive number and not exceed 10')).toBe(true);
    });

    it('should reject non-numeric amount string', async () => {
      const middleware = validate(gasDistributionSchema);
      req.body = {
        address: TEST_DATA.ADDRESSES.VALID,
        amount: 'not-a-number',
      };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.errors.some((e: any) => e.message === 'Amount must be a positive number and not exceed 10')).toBe(true);
    });

    it('should accept valid amounts at boundaries', async () => {
      const middleware = validate(gasDistributionSchema);
      
      // Test minimum valid amount
      req.body = {
        address: TEST_DATA.ADDRESSES.VALID,
        amount: '0.001',
      };

      await middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();

      // Reset for next test
      next.mockClear();

      // Test maximum valid amount
      req.body = {
        address: TEST_DATA.ADDRESSES.VALID,
        amount: '10',
      };

      await middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('paginationSchema', () => {
    it('should validate with default values', async () => {
      const middleware = validate(paginationSchema);
      req.query = {};

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      // Note: This test assumes the middleware processes req.query, but the current implementation processes req.body
    });

    it('should transform string page to number', async () => {
      const middleware = validate(paginationSchema);
      req.body = { page: '2' };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body.page).toBe(2);
    });

    it('should transform string limit to number', async () => {
      const middleware = validate(paginationSchema);
      req.body = { limit: '25' };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body.limit).toBe(25);
    });

    it('should reject negative page numbers', async () => {
      const middleware = validate(paginationSchema);
      req.body = { page: '-1' };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.errors.some((e: any) => e.message === 'Page must be positive')).toBe(true);
    });

    it('should reject zero page numbers', async () => {
      const middleware = validate(paginationSchema);
      req.body = { page: '0' };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.errors.some((e: any) => e.message === 'Page must be positive')).toBe(true);
    });

    it('should reject limit exceeding maximum', async () => {
      const middleware = validate(paginationSchema);
      req.body = { limit: '150' };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.errors.some((e: any) => e.message === 'Limit must be between 1 and 100')).toBe(true);
    });

    it('should reject zero limit', async () => {
      const middleware = validate(paginationSchema);
      req.body = { limit: '0' };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.errors.some((e: any) => e.message === 'Limit must be between 1 and 100')).toBe(true);
    });

    it('should accept valid page and limit values', async () => {
      const middleware = validate(paginationSchema);
      req.body = { page: '5', limit: '50' };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body.page).toBe(5);
      expect(req.body.limit).toBe(50);
    });
  });

  describe('Error formatting', () => {
    it('should format validation errors with field paths', async () => {
      const nestedSchema = z.object({
        user: z.object({
          profile: z.object({
            email: z.string().email(),
            age: z.number().min(18),
          }),
        }),
      });

      const middleware = validate(nestedSchema);
      req.body = {
        user: {
          profile: {
            email: 'invalid-email',
            age: 15,
          },
        },
      };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.errors).toBeDefined();
      expect(error.errors.some((e: any) => e.field === 'user.profile.email')).toBe(true);
      expect(error.errors.some((e: any) => e.field === 'user.profile.age')).toBe(true);
    });

    it('should handle multiple validation errors', async () => {
      const middleware = validate(gasDistributionSchema);
      req.body = {
        address: '', // Invalid: empty
        amount: '-5', // Invalid: negative
      };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.errors).toBeDefined();
      expect(error.errors.length).toBeGreaterThan(1);
    });
  });
});