import { BlockchainService } from '../../../src/services/blockchain.service';
import { BlockchainError, InsufficientBalanceError, SufficientBalanceError } from '../../../src/utils/errors';
import { TEST_DATA } from '../../utils/test-helpers';
import { mockProvider, mockWallet, mockTransactionResponse, mockTransactionReceipt } from '../../__mocks__/ethers';

// Mock ethers
jest.mock('ethers', () => ({
  JsonRpcProvider: jest.fn(() => mockProvider),
  Wallet: jest.fn(() => mockWallet),
  parseEther: jest.fn((value: string) => {
    const parsed = parseFloat(value);
    return BigInt(parsed * 1e18);
  }),
  formatEther: jest.fn((value: bigint) => {
    return (Number(value) / 1e18).toString();
  }),
  parseUnits: jest.fn((value: string, unit: string) => {
    const multiplier = unit === 'gwei' ? 1e9 : 1e18;
    return BigInt(parseFloat(value) * multiplier);
  }),
  formatUnits: jest.fn((value: bigint, unit: string) => {
    const divisor = unit === 'gwei' ? 1e9 : 1e18;
    return (Number(value) / divisor).toString();
  }),
  isAddress: jest.fn((address: string) => {
    return typeof address === 'string' && address.length === 42 && address.startsWith('0x');
  }),
}));

// Mock config
jest.mock('../../../src/config/env.config', () => ({
  config: {
    RPC_URL: 'https://test-rpc.example.com/',
    CHAIN_ID: 31337,
    PRIVATE_KEY: '0x1234567890123456789012345678901234567890123456789012345678901234',
    GAS_AMOUNT: '0.1',
    MINIMUM_BALANCE_THRESHOLD: '0.005',
  },
}));

describe('BlockchainService', () => {
  let blockchainService: BlockchainService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset singleton instance
    (BlockchainService as any).instance = undefined;
    
    // Setup default mock behavior
    mockProvider.getBalance.mockResolvedValue(TEST_DATA.BALANCES.HIGH);
    mockProvider.getBlockNumber.mockResolvedValue(12345);
    mockProvider.getFeeData.mockResolvedValue({
      gasPrice: BigInt('1000000000'), // 1 gwei
    });
    mockWallet.sendTransaction.mockResolvedValue({
      ...mockTransactionResponse,
      wait: jest.fn().mockResolvedValue(mockTransactionReceipt),
    });
    
    blockchainService = BlockchainService.getInstance();
  });

  describe('Singleton pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = BlockchainService.getInstance();
      const instance2 = BlockchainService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should initialize provider and wallet correctly', () => {
      // Verify that the constructor calls were made correctly
      expect(blockchainService.getWalletAddress()).toBe(mockWallet.address);
    });
  });

  describe('getWalletAddress', () => {
    it('should return wallet address', () => {
      const address = blockchainService.getWalletAddress();
      expect(address).toBe(mockWallet.address);
    });
  });

  describe('getBalance', () => {
    it('should return wallet balance successfully', async () => {
      const expectedBalance = TEST_DATA.BALANCES.HIGH;
      mockProvider.getBalance.mockResolvedValue(expectedBalance);

      const balance = await blockchainService.getBalance();

      expect(balance).toBe(expectedBalance);
      expect(mockProvider.getBalance).toHaveBeenCalledWith(mockWallet.address);
    });

    it('should throw BlockchainError when balance retrieval fails', async () => {
      mockProvider.getBalance.mockRejectedValue(new Error('Network error'));

      await expect(blockchainService.getBalance()).rejects.toThrow(BlockchainError);
      await expect(blockchainService.getBalance()).rejects.toThrow('Failed to retrieve wallet balance');
    });
  });

  describe('isValidAddress', () => {
    it('should validate valid addresses', () => {
      expect(blockchainService.isValidAddress(TEST_DATA.ADDRESSES.VALID)).toBe(true);
      expect(blockchainService.isValidAddress(TEST_DATA.ADDRESSES.VALID_2)).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(blockchainService.isValidAddress(TEST_DATA.ADDRESSES.INVALID)).toBe(false);
      expect(blockchainService.isValidAddress(TEST_DATA.ADDRESSES.INVALID_LENGTH)).toBe(false);
      expect(blockchainService.isValidAddress('')).toBe(false);
    });
  });

  describe('getRecipientBalance', () => {
    it('should return recipient balance successfully', async () => {
      const expectedBalance = TEST_DATA.BALANCES.MEDIUM;
      mockProvider.getBalance.mockResolvedValue(expectedBalance);

      const balance = await blockchainService.getRecipientBalance(TEST_DATA.ADDRESSES.VALID);

      expect(balance).toBe(expectedBalance);
      expect(mockProvider.getBalance).toHaveBeenCalledWith(TEST_DATA.ADDRESSES.VALID);
    });

    it('should throw BlockchainError when recipient balance retrieval fails', async () => {
      mockProvider.getBalance.mockRejectedValue(new Error('Network error'));

      await expect(blockchainService.getRecipientBalance(TEST_DATA.ADDRESSES.VALID)).rejects.toThrow(BlockchainError);
      await expect(blockchainService.getRecipientBalance(TEST_DATA.ADDRESSES.VALID)).rejects.toThrow('Failed to retrieve recipient balance');
    });
  });

  describe('distributeGas', () => {
    beforeEach(() => {
      // Setup successful transaction mock
      const mockTx = {
        ...mockTransactionResponse,
        wait: jest.fn().mockResolvedValue(mockTransactionReceipt),
      };
      mockWallet.sendTransaction.mockResolvedValue(mockTx);
    });

    it('should distribute gas successfully', async () => {
      // Setup mocks for successful distribution
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.HIGH); // Wallet balance
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.LOW); // Recipient balance (below threshold)

      const result = await blockchainService.distributeGas(TEST_DATA.ADDRESSES.VALID);

      expect(result).toMatchObject({
        hash: mockTransactionReceipt.hash,
        from: mockTransactionReceipt.from,
        to: mockTransactionReceipt.to,
        status: true,
        blockNumber: mockTransactionReceipt.blockNumber,
      });
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
    });

    it('should distribute gas with custom amount', async () => {
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.HIGH);
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.LOW);

      const customAmount = '0.2';
      await blockchainService.distributeGas(TEST_DATA.ADDRESSES.VALID, customAmount);

      const callArgs = mockWallet.sendTransaction.mock.calls[0][0];
      // The value should be 0.2 ETH in wei
      expect(callArgs.value).toBe(BigInt('200000000000000000'));
    });

    it('should reject invalid recipient address', async () => {
      await expect(blockchainService.distributeGas(TEST_DATA.ADDRESSES.INVALID)).rejects.toThrow(BlockchainError);
      await expect(blockchainService.distributeGas(TEST_DATA.ADDRESSES.INVALID)).rejects.toThrow('Invalid recipient address');
    });

    it('should reject distribution to same wallet address', async () => {
      await expect(blockchainService.distributeGas(mockWallet.address)).rejects.toThrow(BlockchainError);
      await expect(blockchainService.distributeGas(mockWallet.address)).rejects.toThrow('Cannot distribute gas to the same wallet');
    });

    it('should throw SufficientBalanceError when recipient has sufficient balance', async () => {
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.HIGH); // Wallet balance
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.HIGH); // Recipient balance (above threshold)

      await expect(blockchainService.distributeGas(TEST_DATA.ADDRESSES.VALID)).rejects.toThrow(SufficientBalanceError);
    });

    it('should throw InsufficientBalanceError when wallet has insufficient balance', async () => {
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.LOW); // Wallet balance (too low)
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.LOW); // Recipient balance

      await expect(blockchainService.distributeGas(TEST_DATA.ADDRESSES.VALID)).rejects.toThrow(InsufficientBalanceError);
    });

    it('should handle transaction failure (no receipt)', async () => {
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.HIGH);
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.LOW);
      
      const mockTx = {
        ...mockTransactionResponse,
        wait: jest.fn().mockResolvedValue(null), // No receipt
      };
      mockWallet.sendTransaction.mockResolvedValue(mockTx);

      await expect(blockchainService.distributeGas(TEST_DATA.ADDRESSES.VALID)).rejects.toThrow(BlockchainError);
      await expect(blockchainService.distributeGas(TEST_DATA.ADDRESSES.VALID)).rejects.toThrow('Transaction failed - no receipt');
    });

    it('should handle failed transaction status', async () => {
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.HIGH);
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.LOW);
      
      const failedReceipt = {
        ...mockTransactionReceipt,
        status: 0, // Failed status
      };
      const mockTx = {
        ...mockTransactionResponse,
        wait: jest.fn().mockResolvedValue(failedReceipt),
      };
      mockWallet.sendTransaction.mockResolvedValue(mockTx);

      await expect(blockchainService.distributeGas(TEST_DATA.ADDRESSES.VALID)).rejects.toThrow(BlockchainError);
      await expect(blockchainService.distributeGas(TEST_DATA.ADDRESSES.VALID)).rejects.toThrow('Transaction failed');
    });

    it('should handle network errors during transaction', async () => {
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.HIGH);
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.LOW);
      mockWallet.sendTransaction.mockRejectedValue(new Error('network error occurred'));

      await expect(blockchainService.distributeGas(TEST_DATA.ADDRESSES.VALID)).rejects.toThrow(BlockchainError);
      await expect(blockchainService.distributeGas(TEST_DATA.ADDRESSES.VALID)).rejects.toThrow('Network error - please try again later');
    });

    it('should handle insufficient funds error from ethers', async () => {
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.HIGH);
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.LOW);
      mockWallet.sendTransaction.mockRejectedValue(new Error('insufficient funds for intrinsic transaction cost'));

      await expect(blockchainService.distributeGas(TEST_DATA.ADDRESSES.VALID)).rejects.toThrow(InsufficientBalanceError);
    });

    it('should use default gas settings', async () => {
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.HIGH);
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.LOW);

      await blockchainService.distributeGas(TEST_DATA.ADDRESSES.VALID);

      const callArgs = mockWallet.sendTransaction.mock.calls[0][0];
      expect(callArgs.gasPrice).toBe(BigInt('1000000000')); // 1 gwei
      expect(callArgs.to).toBe(TEST_DATA.ADDRESSES.VALID);
    });
  });

  describe('getTransaction', () => {
    it('should return transaction details successfully', async () => {
      const expectedTx = mockTransactionResponse;
      mockProvider.getTransaction.mockResolvedValue(expectedTx);

      const result = await blockchainService.getTransaction(TEST_DATA.TRANSACTION_HASHES.VALID);

      expect(result).toBe(expectedTx);
      expect(mockProvider.getTransaction).toHaveBeenCalledWith(TEST_DATA.TRANSACTION_HASHES.VALID);
    });

    it('should return null when transaction is not found', async () => {
      mockProvider.getTransaction.mockResolvedValue(null);

      const result = await blockchainService.getTransaction(TEST_DATA.TRANSACTION_HASHES.VALID);

      expect(result).toBeNull();
    });

    it('should return null when transaction retrieval fails', async () => {
      mockProvider.getTransaction.mockRejectedValue(new Error('Network error'));

      const result = await blockchainService.getTransaction(TEST_DATA.TRANSACTION_HASHES.VALID);

      expect(result).toBeNull();
    });
  });

  describe('estimateGas', () => {
    it('should return gas estimation successfully', async () => {
      const expectedGas = BigInt(21000);
      mockWallet.estimateGas.mockResolvedValue(expectedGas);

      const result = await blockchainService.estimateGas(TEST_DATA.ADDRESSES.VALID, '0.1');

      expect(result).toBe(expectedGas);
      expect(mockWallet.estimateGas).toHaveBeenCalledWith({
        to: TEST_DATA.ADDRESSES.VALID,
        value: BigInt('100000000000000000'), // 0.1 ETH in wei
      });
    });

    it('should throw BlockchainError when gas estimation fails', async () => {
      mockWallet.estimateGas.mockRejectedValue(new Error('Estimation failed'));

      await expect(blockchainService.estimateGas(TEST_DATA.ADDRESSES.VALID, '0.1')).rejects.toThrow(BlockchainError);
      await expect(blockchainService.estimateGas(TEST_DATA.ADDRESSES.VALID, '0.1')).rejects.toThrow('Failed to estimate gas cost');
    });
  });

  describe('getGasPrice', () => {
    it('should return current gas price successfully', async () => {
      const expectedGasPrice = BigInt('2000000000'); // 2 gwei
      mockProvider.getFeeData.mockResolvedValue({
        gasPrice: expectedGasPrice,
      });

      const result = await blockchainService.getGasPrice();

      expect(result).toBe(expectedGasPrice);
    });

    it('should return default gas price when feeData.gasPrice is null', async () => {
      mockProvider.getFeeData.mockResolvedValue({
        gasPrice: null,
      });

      const result = await blockchainService.getGasPrice();

      expect(result).toBe(BigInt('1000000000')); // Default 1 gwei
    });

    it('should throw BlockchainError when gas price retrieval fails', async () => {
      mockProvider.getFeeData.mockRejectedValue(new Error('Network error'));

      await expect(blockchainService.getGasPrice()).rejects.toThrow(BlockchainError);
      await expect(blockchainService.getGasPrice()).rejects.toThrow('Failed to retrieve gas price');
    });
  });

  describe('healthCheck', () => {
    it('should return true when blockchain is accessible', async () => {
      mockProvider.getBlockNumber.mockResolvedValue(12345);

      const result = await blockchainService.healthCheck();

      expect(result).toBe(true);
      expect(mockProvider.getBlockNumber).toHaveBeenCalled();
    });

    it('should return false when block number is 0', async () => {
      mockProvider.getBlockNumber.mockResolvedValue(0);

      const result = await blockchainService.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false when blockchain is not accessible', async () => {
      mockProvider.getBlockNumber.mockRejectedValue(new Error('Network error'));

      const result = await blockchainService.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle case-insensitive address comparison in self-transfer check', async () => {
      const upperCaseAddress = mockWallet.address.toUpperCase();
      
      await expect(blockchainService.distributeGas(upperCaseAddress)).rejects.toThrow(BlockchainError);
      await expect(blockchainService.distributeGas(upperCaseAddress)).rejects.toThrow('Cannot distribute gas to the same wallet');
    });

    it('should handle very large amounts correctly', async () => {
      mockProvider.getBalance.mockResolvedValueOnce(BigInt('1000000000000000000000')); // 1000 ETH
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.LOW);

      const largeAmount = '999';
      await blockchainService.distributeGas(TEST_DATA.ADDRESSES.VALID, largeAmount);

      const callArgs = mockWallet.sendTransaction.mock.calls[0][0];
      expect(callArgs.value).toBe(BigInt('999000000000000000000')); // 999 ETH in wei
    });

    it('should handle precision in balance comparisons', async () => {
      // Set recipient balance exactly at threshold
      const thresholdBalance = BigInt('5000000000000000'); // 0.005 ETH in wei
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.HIGH);
      mockProvider.getBalance.mockResolvedValueOnce(thresholdBalance);

      await expect(blockchainService.distributeGas(TEST_DATA.ADDRESSES.VALID)).rejects.toThrow(SufficientBalanceError);
    });

    it('should include transaction timestamp in result', async () => {
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.HIGH);
      mockProvider.getBalance.mockResolvedValueOnce(TEST_DATA.BALANCES.LOW);

      const beforeTime = new Date().getTime();
      const result = await blockchainService.distributeGas(TEST_DATA.ADDRESSES.VALID);
      const afterTime = new Date().getTime();

      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(afterTime);
    });
  });
});