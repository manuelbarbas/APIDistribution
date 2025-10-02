import { Request } from 'express';

/**
 * Gas distribution request payload
 */
export interface GasDistributionRequest {
  address: string;
  amount?: string;
}

/**
 * Gas distribution response
 */
export interface GasDistributionResponse {
  success: boolean;
  transactionHash?: string;
  recipient: string;
  amount: string;
  message?: string;
  timestamp: string;
}

/**
 * Extended Express Request with API key validation
 */
export interface AuthenticatedRequest extends Request {
  apiKey?: string;
  requestId?: string;
}

/**
 * Rate limit store entry
 */
export interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

/**
 * Transaction receipt info
 */
export interface TransactionInfo {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed?: string;
  status: boolean;
  blockNumber?: number;
  timestamp: Date;
}