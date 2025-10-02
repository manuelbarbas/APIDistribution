import { Request, Response, NextFunction } from 'express';
import { BlockchainService } from '../services/blockchain.service';
import { GasDistributionRequest, GasDistributionResponse, AuthenticatedRequest } from '../types';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';
import { ethers } from 'ethers';

/**
 * Controller for gas distribution endpoints
 */
export class GasController {
  private blockchainService: BlockchainService;

  constructor() {
    this.blockchainService = BlockchainService.getInstance();
  }

  /**
   * Distribute gas to a specified address
   */
  public distributeGas = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { address, amount } = req.body as GasDistributionRequest;
      const requestId = req.requestId;

      logger.info('Processing gas distribution request', {
        requestId,
        recipient: address,
        amount: amount || 'default',
      });

      // Perform gas distribution
      const transactionInfo = await this.blockchainService.distributeGas(address, amount);

      // Format response
      const response: GasDistributionResponse = {
        success: true,
        transactionHash: transactionInfo.hash,
        recipient: address,
        amount: ethers.formatEther(transactionInfo.value),
        timestamp: transactionInfo.timestamp.toISOString(),
        message: 'Gas distribution successful',
      };

      logger.info('Gas distribution completed', {
        requestId,
        transactionHash: transactionInfo.hash,
        recipient: address,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get wallet information
   */
  public getWalletInfo = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const walletAddress = this.blockchainService.getWalletAddress();
      const balance = await this.blockchainService.getBalance();

      res.status(200).json({
        success: true,
        wallet: {
          address: walletAddress,
          balance: ethers.formatEther(balance),
          currency: 'FAIR',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Check recipient balance
   */
  public checkBalance = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { address } = req.params;

      if (!this.blockchainService.isValidAddress(address)) {
        throw new AppError('Invalid address format', 400);
      }

      const balance = await this.blockchainService.getRecipientBalance(address);

      res.status(200).json({
        success: true,
        address,
        balance: ethers.formatEther(balance),
        currency: 'FAIR',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Estimate gas cost for distribution
   */
  public estimateGas = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { address, amount } = req.body;

      if (!this.blockchainService.isValidAddress(address)) {
        throw new AppError('Invalid address format', 400);
      }

      const gasAmount = amount || '0.1';
      const estimatedGas = await this.blockchainService.estimateGas(address, gasAmount);
      const gasPrice = await this.blockchainService.getGasPrice();
      
      const totalCostWei = estimatedGas * gasPrice;
      const totalCostEther = ethers.formatEther(totalCostWei);

      res.status(200).json({
        success: true,
        estimation: {
          gasLimit: estimatedGas.toString(),
          gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
          totalCost: totalCostEther,
          currency: 'FAIR',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get transaction status
   */
  public getTransactionStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { txHash } = req.params;

      const transaction = await this.blockchainService.getTransaction(txHash);
      
      if (!transaction) {
        throw new AppError('Transaction not found', 404);
      }

      res.status(200).json({
        success: true,
        transaction: {
          hash: transaction.hash,
          from: transaction.from,
          to: transaction.to,
          value: ethers.formatEther(transaction.value),
          blockNumber: transaction.blockNumber,
          confirmations: transaction.confirmations,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Health check endpoint
   */
  public healthCheck = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const isHealthy = await this.blockchainService.healthCheck();
      const walletAddress = this.blockchainService.getWalletAddress();
      
      let balance = '0';
      try {
        const balanceWei = await this.blockchainService.getBalance();
        balance = ethers.formatEther(balanceWei);
      } catch {
        // Ignore balance fetch errors in health check
      }

      res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        status: isHealthy ? 'healthy' : 'unhealthy',
        service: 'gas-distribution-api',
        blockchain: {
          connected: isHealthy,
          network: 'FAIR Testnet',
          chainId: 935,
          walletAddress,
          walletBalance: balance,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}