import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.config';
import { AuthenticationError } from '../utils/errors';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';
import crypto from 'crypto';

/**
 * Middleware to validate API key authentication
 */
export const authenticateApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      throw new AuthenticationError('API key is required');
    }

    if (!validateApiKey(apiKey)) {
      logger.warn('Invalid API key attempt', {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      throw new AuthenticationError('Invalid API key');
    }

    // Add API key and request ID to request object
    req.apiKey = apiKey;
    req.requestId = generateRequestId();

    logger.info('API request authenticated', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Extract API key from request headers or query parameters
 */
const extractApiKey = (req: Request): string | undefined => {
  // Check Authorization header first (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check X-API-Key header
  const xApiKey = req.headers['x-api-key'];
  if (xApiKey && typeof xApiKey === 'string') {
    return xApiKey;
  }

  // Check query parameter as fallback (not recommended for production)
  if (config.NODE_ENV === 'development' && req.query.apiKey) {
    return req.query.apiKey as string;
  }

  return undefined;
};

/**
 * Validate API key using constant-time comparison
 */
const validateApiKey = (apiKey: string): boolean => {
  const configuredKey = config.API_KEY;
  
  // Ensure both strings are the same length for timing attack prevention
  if (apiKey.length !== configuredKey.length) {
    return false;
  }

  // Use constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(apiKey),
    Buffer.from(configuredKey)
  );
};

/**
 * Generate unique request ID for tracking
 */
const generateRequestId = (): string => {
  return crypto.randomBytes(16).toString('hex');
};