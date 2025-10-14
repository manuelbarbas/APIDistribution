import { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../src/app';
import logger from '../src/utils/logger';
import { BlockchainService } from '../src/services/blockchain.service';

let app: any;

/**
 * Initialize the application once (cold start optimization)
 */
const initApp = async () => {
  if (!app) {
    try {
      // Initialize blockchain service
      const blockchainService = BlockchainService.getInstance();
      
      // Perform health check (non-blocking for serverless)
      const isHealthy = await blockchainService.healthCheck();
      if (!isHealthy) {
        logger.warn('Blockchain connection health check failed, but API will continue');
      }

      // Get wallet info for logging
      const walletAddress = blockchainService.getWalletAddress();
      logger.info('Serverless function initialized', { 
        address: walletAddress,
        environment: process.env.NODE_ENV 
      });

      // Create Express app
      app = createApp();
      
      logger.info('App initialized for serverless deployment');
    } catch (error) {
      logger.error('Failed to initialize serverless app:', error);
      throw error;
    }
  }
  return app;
};

/**
 * Vercel serverless function handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const expressApp = await initApp();
    
    // Handle the request using Express
    return expressApp(req, res);
  } catch (error) {
    logger.error('Serverless function error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to process request'
    });
  }
}