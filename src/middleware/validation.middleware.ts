import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';
import { ethers } from 'ethers';

/**
 * Generic validation middleware factory
 */
export const validate = <T>(schema: z.ZodSchema<T>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(new ValidationError('Validation failed', formattedErrors));
      } else {
        next(error);
      }
    }
  };
};

/**
 * Gas distribution request validation schema
 */
export const gasDistributionSchema = z.object({
  address: z
    .string()
    .min(1, 'Address is required')
    .refine((val) => ethers.isAddress(val), {
      message: 'Invalid Ethereum address format',
    }),
  amount: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        try {
          const parsed = parseFloat(val);
          return parsed > 0 && parsed <= 10; // Max 10 tokens per request
        } catch {
          return false;
        }
      },
      {
        message: 'Amount must be a positive number and not exceed 10',
      }
    ),
});

/**
 * Query validation schemas
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val > 0, 'Page must be positive'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
});