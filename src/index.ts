import { createApp } from './app';
import { config } from './config/env.config';
import logger from './utils/logger';
import { BlockchainService } from './services/blockchain.service';

/**
 * Server instance
 */
let server: any;

/**
 * Start the server
 */
const startServer = async (): Promise<void> => {
  try {
    // Initialize blockchain service
    const blockchainService = BlockchainService.getInstance();
    
    // Perform health check
    const isHealthy = await blockchainService.healthCheck();
    if (!isHealthy) {
      logger.warn('Blockchain connection health check failed, but server will start');
    }

    // Get wallet info for logging
    const walletAddress = blockchainService.getWalletAddress();
    logger.info('Wallet initialized', { address: walletAddress });

    // Create Express app
    const app = createApp();

    // Start server
    server = app.listen(config.PORT, () => {
      logger.info(`🚀 Server is running`, {
        port: config.PORT,
        environment: config.NODE_ENV,
        walletAddress,
        chainId: config.CHAIN_ID,
        rpcUrl: config.RPC_URL,
      });
    });

    // Error handling for server
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.PORT} is already in use`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} signal received: closing HTTP server`);
  
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  }
};

// Handle process termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();