import { ethers } from 'ethers';
import { config } from '../config/env.config';
import { TransactionInfo } from '../types';
import { BlockchainError, InsufficientBalanceError, SufficientBalanceError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Service class for blockchain interactions
 */
export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private static instance: BlockchainService;

  private constructor() {
    // Initialize provider with FAIR Testnet RPC
    this.provider = new ethers.JsonRpcProvider(
      config.RPC_URL,
      {
        chainId: config.CHAIN_ID,
        name: 'FAIR Testnet',
      }
    );

    // Initialize wallet with private key
    this.wallet = new ethers.Wallet(config.PRIVATE_KEY, this.provider);
    
    logger.info('Blockchain service initialized', {
      chainId: config.CHAIN_ID,
      rpcUrl: config.RPC_URL,
      walletAddress: this.wallet.address,
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): BlockchainService {
    if (!BlockchainService.instance) {
      BlockchainService.instance = new BlockchainService();
    }
    return BlockchainService.instance;
  }

  /**
   * Get wallet address
   */
  public getWalletAddress(): string {
    return this.wallet.address;
  }

  /**
   * Get current wallet balance
   */
  public async getBalance(): Promise<bigint> {
    try {
      return await this.provider.getBalance(this.wallet.address);
    } catch (error) {
      logger.error('Failed to get wallet balance', { error });
      throw new BlockchainError('Failed to retrieve wallet balance');
    }
  }

  /**
   * Check if address is valid
   */
  public isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Get recipient balance
   */
  public async getRecipientBalance(address: string): Promise<bigint> {
    try {
      return await this.provider.getBalance(address);
    } catch (error) {
      logger.error('Failed to get recipient balance', { address, error });
      throw new BlockchainError('Failed to retrieve recipient balance');
    }
  }

  /**
   * Distribute gas to recipient address
   */
  public async distributeGas(
    recipientAddress: string,
    amount?: string
  ): Promise<TransactionInfo> {
    try {
      // Validate recipient address
      if (!this.isValidAddress(recipientAddress)) {
        throw new BlockchainError('Invalid recipient address');
      }

      // Use configured amount or provided amount
      const gasAmount = amount || config.GAS_AMOUNT;
      const valueInWei = ethers.parseEther(gasAmount);

      // Check recipient's current balance
      const recipientBalance = await this.getRecipientBalance(recipientAddress);
      const minimumBalanceThreshold = config.MINIMUM_BALANCE_THRESHOLD || '0.005';
      const minimumBalance = ethers.parseEther(minimumBalanceThreshold);
      
      if (recipientBalance >= minimumBalance) {
        const currentBalanceFormatted = ethers.formatEther(recipientBalance);
        logger.info('Recipient has sufficient balance', {
          recipient: recipientAddress,
          currentBalance: currentBalanceFormatted,
          threshold: minimumBalanceThreshold,
        });
        throw new SufficientBalanceError(
          `You have enough sFUEL. Current balance: ${currentBalanceFormatted} FAIR (minimum required: ${minimumBalanceThreshold} FAIR)`,
          currentBalanceFormatted,
          minimumBalanceThreshold
        );
      }

      // Check wallet balance
      const balance = await this.getBalance();
      if (balance < valueInWei) {
        logger.error('Insufficient balance for distribution', {
          required: valueInWei.toString(),
          available: balance.toString(),
        });
        throw new InsufficientBalanceError(
          `Insufficient balance. Required: ${gasAmount} FAIR, Available: ${ethers.formatEther(balance)} FAIR`
        );
      }

      // Prevent self-transfer
      if (recipientAddress.toLowerCase() === this.wallet.address.toLowerCase()) {
        throw new BlockchainError('Cannot distribute gas to the same wallet');
      }

      logger.info('Initiating gas distribution', {
        recipient: recipientAddress,
        amount: gasAmount,
        valueInWei: valueInWei.toString(),
      });

      // Prepare transaction
      const transaction = {
        to: recipientAddress,
        value: valueInWei,
        // Gas settings for FAIR Testnet
        gasLimit: 21000n, // Standard transfer gas limit
      };

      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');

      // Send transaction
      const tx = await this.wallet.sendTransaction({
        ...transaction,
        gasPrice,
      });

      logger.info('Transaction sent', {
        hash: tx.hash,
        recipient: recipientAddress,
        amount: gasAmount,
      });

      // Wait for confirmation
      const receipt = await tx.wait();

      if (!receipt) {
        throw new BlockchainError('Transaction failed - no receipt');
      }

      const transactionInfo: TransactionInfo = {
        hash: receipt.hash,
        from: receipt.from,
        to: receipt.to || recipientAddress,
        value: valueInWei.toString(),
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1,
        blockNumber: receipt.blockNumber,
        timestamp: new Date(),
      };

      if (!transactionInfo.status) {
        throw new BlockchainError('Transaction failed', receipt.hash);
      }

      logger.info('Gas distribution successful', {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      });

      return transactionInfo;
    } catch (error) {
      // Re-throw custom errors
      if (error instanceof SufficientBalanceError || error instanceof BlockchainError || error instanceof InsufficientBalanceError) {
        throw error;
      }

      // Handle ethers errors
      if (error instanceof Error) {
        logger.error('Blockchain operation failed', {
          error: error.message,
          stack: error.stack,
        });

        // Parse common ethers errors
        if (error.message.includes('insufficient funds')) {
          throw new InsufficientBalanceError();
        }
        
        if (error.message.includes('network')) {
          throw new BlockchainError('Network error - please try again later');
        }
      }

      throw new BlockchainError('Transaction failed - unexpected error');
    }
  }

  /**
   * Get transaction details by hash
   */
  public async getTransaction(txHash: string): Promise<ethers.TransactionResponse | null> {
    try {
      return await this.provider.getTransaction(txHash);
    } catch (error) {
      logger.error('Failed to get transaction', { txHash, error });
      return null;
    }
  }

  /**
   * Estimate gas for transaction
   */
  public async estimateGas(recipientAddress: string, amount: string): Promise<bigint> {
    try {
      const valueInWei = ethers.parseEther(amount);
      
      const estimatedGas = await this.wallet.estimateGas({
        to: recipientAddress,
        value: valueInWei,
      });

      return estimatedGas;
    } catch (error) {
      logger.error('Failed to estimate gas', { recipientAddress, amount, error });
      throw new BlockchainError('Failed to estimate gas cost');
    }
  }

  /**
   * Get current gas price
   */
  public async getGasPrice(): Promise<bigint> {
    try {
      const feeData = await this.provider.getFeeData();
      return feeData.gasPrice || ethers.parseUnits('1', 'gwei');
    } catch (error) {
      logger.error('Failed to get gas price', { error });
      throw new BlockchainError('Failed to retrieve gas price');
    }
  }

  /**
   * Health check for blockchain connection
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      return blockNumber > 0;
    } catch (error) {
      logger.error('Blockchain health check failed', { error });
      return false;
    }
  }
}