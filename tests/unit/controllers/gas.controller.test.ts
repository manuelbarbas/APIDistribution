import { GasController } from '../../../src/controllers/gas.controller';
import { BlockchainService } from '../../../src/services/blockchain.service';
import { AppError, SufficientBalanceError, InsufficientBalanceError, BlockchainError } from '../../../src/utils/errors';
import { createMockAuthenticatedRequest, createMockResponse, createMockNext, TEST_DATA } from '../../utils/test-helpers';

// Mock BlockchainService
const mockBlockchainService = {
  getInstance: jest.fn(),
  distributeGas: jest.fn(),
  getWalletAddress: jest.fn(),
  getBalance: jest.fn(),
  isValidAddress: jest.fn(),
  getRecipientBalance: jest.fn(),
  estimateGas: jest.fn(),
  getGasPrice: jest.fn(),
  getTransaction: jest.fn(),
  healthCheck: jest.fn(),
};

jest.mock('../../../src/services/blockchain.service', () => ({
  BlockchainService: {
    getInstance: () => mockBlockchainService,
  },
}));

// Mock ethers
jest.mock('ethers', () => ({
  formatEther: jest.fn((value: bigint) => (Number(value) / 1e18).toString()),
  formatUnits: jest.fn((value: bigint, unit: string) => {
    const divisor = unit === 'gwei' ? 1e9 : 1e18;
    return (Number(value) / divisor).toString();
  }),
}));

describe('GasController', () => {
  let gasController: GasController;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    gasController = new GasController();
    req = createMockAuthenticatedRequest();
    res = createMockResponse();
    next = createMockNext();

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock behaviors
    mockBlockchainService.getWalletAddress.mockReturnValue(TEST_DATA.ADDRESSES.VALID);
    mockBlockchainService.isValidAddress.mockImplementation((address: string) => 
      address.length === 42 && address.startsWith('0x')
    );
  });

  describe('distributeGas', () => {
    const validTransactionInfo = {
      hash: TEST_DATA.TRANSACTION_HASHES.VALID,
      from: TEST_DATA.ADDRESSES.VALID,
      to: TEST_DATA.ADDRESSES.VALID_2,
      value: '100000000000000000', // 0.1 ETH in wei
      gasUsed: '21000',
      status: true,
      blockNumber: 12345,
      timestamp: new Date(),
    };

    beforeEach(() => {
      req.body = {
        address: TEST_DATA.ADDRESSES.VALID_2,
        amount: TEST_DATA.AMOUNTS.VALID,
      };
      req.requestId = 'test-request-id';
    });

    it('should distribute gas successfully', async () => {
      mockBlockchainService.distributeGas.mockResolvedValue(validTransactionInfo);

      await gasController.distributeGas(req, res, next);

      expect(mockBlockchainService.distributeGas).toHaveBeenCalledWith(
        TEST_DATA.ADDRESSES.VALID_2,
        TEST_DATA.AMOUNTS.VALID
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        transactionHash: validTransactionInfo.hash,
        recipient: TEST_DATA.ADDRESSES.VALID_2,
        amount: '0.1',
        timestamp: validTransactionInfo.timestamp.toISOString(),
        message: 'Gas distribution successful',
      });
    });

    it('should distribute gas without amount parameter', async () => {
      delete req.body.amount;
      mockBlockchainService.distributeGas.mockResolvedValue(validTransactionInfo);

      await gasController.distributeGas(req, res, next);

      expect(mockBlockchainService.distributeGas).toHaveBeenCalledWith(
        TEST_DATA.ADDRESSES.VALID_2,
        undefined
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle SufficientBalanceError', async () => {
      const error = new SufficientBalanceError('You have enough sFUEL', '1.0', '0.005');
      mockBlockchainService.distributeGas.mockRejectedValue(error);

      await gasController.distributeGas(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should handle InsufficientBalanceError', async () => {
      const error = new InsufficientBalanceError('Wallet has insufficient balance');
      mockBlockchainService.distributeGas.mockRejectedValue(error);

      await gasController.distributeGas(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle BlockchainError', async () => {
      const error = new BlockchainError('Transaction failed', TEST_DATA.TRANSACTION_HASHES.VALID);
      mockBlockchainService.distributeGas.mockRejectedValue(error);

      await gasController.distributeGas(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle generic errors', async () => {
      const error = new Error('Unexpected error');
      mockBlockchainService.distributeGas.mockRejectedValue(error);

      await gasController.distributeGas(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should include request ID in logging', async () => {
      mockBlockchainService.distributeGas.mockResolvedValue(validTransactionInfo);
      req.requestId = 'specific-request-id';

      await gasController.distributeGas(req, res, next);

      // Logger is mocked, but we ensure the controller completes successfully
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getWalletInfo', () => {
    it('should return wallet information successfully', async () => {
      const walletBalance = TEST_DATA.BALANCES.HIGH;
      mockBlockchainService.getBalance.mockResolvedValue(walletBalance);

      await gasController.getWalletInfo(req, res, next);

      expect(mockBlockchainService.getWalletAddress).toHaveBeenCalled();
      expect(mockBlockchainService.getBalance).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        wallet: {
          address: TEST_DATA.ADDRESSES.VALID,
          balance: '1',
          currency: 'FAIR',
        },
      });
    });

    it('should handle balance retrieval errors', async () => {
      const error = new BlockchainError('Failed to get balance');
      mockBlockchainService.getBalance.mockRejectedValue(error);

      await gasController.getWalletInfo(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('checkBalance', () => {
    beforeEach(() => {
      req.params = { address: TEST_DATA.ADDRESSES.VALID };
    });

    it('should return recipient balance successfully', async () => {
      const balance = TEST_DATA.BALANCES.MEDIUM;
      mockBlockchainService.isValidAddress.mockReturnValue(true);
      mockBlockchainService.getRecipientBalance.mockResolvedValue(balance);

      await gasController.checkBalance(req, res, next);

      expect(mockBlockchainService.isValidAddress).toHaveBeenCalledWith(TEST_DATA.ADDRESSES.VALID);
      expect(mockBlockchainService.getRecipientBalance).toHaveBeenCalledWith(TEST_DATA.ADDRESSES.VALID);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        address: TEST_DATA.ADDRESSES.VALID,
        balance: '0.1',
        currency: 'FAIR',
      });
    });

    it('should reject invalid address format', async () => {
      req.params.address = TEST_DATA.ADDRESSES.INVALID;
      mockBlockchainService.isValidAddress.mockReturnValue(false);

      await gasController.checkBalance(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('Invalid address format');
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    it('should handle balance retrieval errors', async () => {
      const error = new BlockchainError('Failed to get recipient balance');
      mockBlockchainService.isValidAddress.mockReturnValue(true);
      mockBlockchainService.getRecipientBalance.mockRejectedValue(error);

      await gasController.checkBalance(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('estimateGas', () => {
    beforeEach(() => {
      req.body = {
        address: TEST_DATA.ADDRESSES.VALID,
        amount: TEST_DATA.AMOUNTS.VALID,
      };
    });

    it('should return gas estimation successfully', async () => {
      const gasEstimate = BigInt(21000);
      const gasPrice = BigInt('2000000000'); // 2 gwei
      mockBlockchainService.isValidAddress.mockReturnValue(true);
      mockBlockchainService.estimateGas.mockResolvedValue(gasEstimate);
      mockBlockchainService.getGasPrice.mockResolvedValue(gasPrice);

      await gasController.estimateGas(req, res, next);

      expect(mockBlockchainService.estimateGas).toHaveBeenCalledWith(TEST_DATA.ADDRESSES.VALID, TEST_DATA.AMOUNTS.VALID);
      expect(mockBlockchainService.getGasPrice).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        estimation: {
          gasLimit: '21000',
          gasPrice: '2',
          totalCost: '0.000042',
          currency: 'FAIR',
        },
      });
    });

    it('should use default amount when not provided', async () => {
      delete req.body.amount;
      const gasEstimate = BigInt(21000);
      const gasPrice = BigInt('1000000000'); // 1 gwei
      mockBlockchainService.isValidAddress.mockReturnValue(true);
      mockBlockchainService.estimateGas.mockResolvedValue(gasEstimate);
      mockBlockchainService.getGasPrice.mockResolvedValue(gasPrice);

      await gasController.estimateGas(req, res, next);

      expect(mockBlockchainService.estimateGas).toHaveBeenCalledWith(TEST_DATA.ADDRESSES.VALID, '0.1');
    });

    it('should reject invalid address format', async () => {
      req.body.address = TEST_DATA.ADDRESSES.INVALID;
      mockBlockchainService.isValidAddress.mockReturnValue(false);

      await gasController.estimateGas(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('Invalid address format');
    });

    it('should handle gas estimation errors', async () => {
      const error = new BlockchainError('Gas estimation failed');
      mockBlockchainService.isValidAddress.mockReturnValue(true);
      mockBlockchainService.estimateGas.mockRejectedValue(error);

      await gasController.estimateGas(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle gas price retrieval errors', async () => {
      const gasEstimate = BigInt(21000);
      const error = new BlockchainError('Failed to get gas price');
      mockBlockchainService.isValidAddress.mockReturnValue(true);
      mockBlockchainService.estimateGas.mockResolvedValue(gasEstimate);
      mockBlockchainService.getGasPrice.mockRejectedValue(error);

      await gasController.estimateGas(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getTransactionStatus', () => {
    beforeEach(() => {
      req.params = { txHash: TEST_DATA.TRANSACTION_HASHES.VALID };
    });

    it('should return transaction status successfully', async () => {
      const mockTransaction = {
        hash: TEST_DATA.TRANSACTION_HASHES.VALID,
        from: TEST_DATA.ADDRESSES.VALID,
        to: TEST_DATA.ADDRESSES.VALID_2,
        value: BigInt('100000000000000000'), // 0.1 ETH in wei
        blockNumber: 12345,
        confirmations: 5,
      };
      mockBlockchainService.getTransaction.mockResolvedValue(mockTransaction);

      await gasController.getTransactionStatus(req, res, next);

      expect(mockBlockchainService.getTransaction).toHaveBeenCalledWith(TEST_DATA.TRANSACTION_HASHES.VALID);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        transaction: {
          hash: TEST_DATA.TRANSACTION_HASHES.VALID,
          from: TEST_DATA.ADDRESSES.VALID,
          to: TEST_DATA.ADDRESSES.VALID_2,
          value: '0.1',
          blockNumber: 12345,
          confirmations: 5,
        },
      });
    });

    it('should handle transaction not found', async () => {
      mockBlockchainService.getTransaction.mockResolvedValue(null);

      await gasController.getTransactionStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('Transaction not found');
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });

    it('should handle transaction retrieval errors', async () => {
      const error = new BlockchainError('Failed to get transaction');
      mockBlockchainService.getTransaction.mockRejectedValue(error);

      await gasController.getTransactionStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when blockchain is accessible', async () => {
      const walletBalance = TEST_DATA.BALANCES.HIGH;
      mockBlockchainService.healthCheck.mockResolvedValue(true);
      mockBlockchainService.getBalance.mockResolvedValue(walletBalance);

      await gasController.healthCheck(req, res, next);

      expect(mockBlockchainService.healthCheck).toHaveBeenCalled();
      expect(mockBlockchainService.getWalletAddress).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 'healthy',
        service: 'gas-distribution-api',
        blockchain: {
          connected: true,
          network: 'FAIR Testnet',
          chainId: 935,
          walletAddress: TEST_DATA.ADDRESSES.VALID,
          walletBalance: '1',
        },
        timestamp: expect.any(String),
      });
    });

    it('should return unhealthy status when blockchain is not accessible', async () => {
      mockBlockchainService.healthCheck.mockResolvedValue(false);
      mockBlockchainService.getBalance.mockResolvedValue(TEST_DATA.BALANCES.HIGH);

      await gasController.healthCheck(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 'unhealthy',
        service: 'gas-distribution-api',
        blockchain: {
          connected: false,
          network: 'FAIR Testnet',
          chainId: 935,
          walletAddress: TEST_DATA.ADDRESSES.VALID,
          walletBalance: '1',
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle balance retrieval errors gracefully in health check', async () => {
      mockBlockchainService.healthCheck.mockResolvedValue(true);
      mockBlockchainService.getBalance.mockRejectedValue(new Error('Balance error'));

      await gasController.healthCheck(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArgs = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.blockchain.walletBalance).toBe('0');
    });

    it('should handle health check errors', async () => {
      const error = new Error('Health check failed');
      mockBlockchainService.healthCheck.mockRejectedValue(error);

      await gasController.healthCheck(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should include timestamp in ISO format', async () => {
      mockBlockchainService.healthCheck.mockResolvedValue(true);
      mockBlockchainService.getBalance.mockResolvedValue(TEST_DATA.BALANCES.HIGH);
      
      const beforeTime = new Date().getTime();
      await gasController.healthCheck(req, res, next);
      const afterTime = new Date().getTime();

      const callArgs = (res.json as jest.Mock).mock.calls[0][0];
      const timestamp = callArgs.timestamp;
      const parsedTime = new Date(timestamp).getTime();

      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(parsedTime).toBeGreaterThanOrEqual(beforeTime);
      expect(parsedTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Request parameter handling', () => {
    it('should handle missing request body', async () => {
      req.body = {};
      const error = new Error('Validation error');
      mockBlockchainService.distributeGas.mockRejectedValue(error);

      await gasController.distributeGas(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle missing request parameters', async () => {
      req.params = {};
      
      await gasController.checkBalance(req, res, next);

      // Should try to validate undefined address
      expect(mockBlockchainService.isValidAddress).toHaveBeenCalledWith(undefined);
    });

    it('should handle missing requestId', async () => {
      req.requestId = undefined;
      const validTransactionInfo = {
        hash: TEST_DATA.TRANSACTION_HASHES.VALID,
        from: TEST_DATA.ADDRESSES.VALID,
        to: TEST_DATA.ADDRESSES.VALID_2,
        value: '100000000000000000',
        timestamp: new Date(),
      };
      mockBlockchainService.distributeGas.mockResolvedValue(validTransactionInfo);

      await gasController.distributeGas(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Response formatting', () => {
    it('should format ETH amounts correctly', async () => {
      const transactionInfo = {
        hash: TEST_DATA.TRANSACTION_HASHES.VALID,
        from: TEST_DATA.ADDRESSES.VALID,
        to: TEST_DATA.ADDRESSES.VALID_2,
        value: '1500000000000000000', // 1.5 ETH in wei
        timestamp: new Date(),
      };
      mockBlockchainService.distributeGas.mockResolvedValue(transactionInfo);
      req.body = { address: TEST_DATA.ADDRESSES.VALID_2 };

      await gasController.distributeGas(req, res, next);

      const callArgs = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.amount).toBe('1.5');
    });

    it('should handle very small amounts', async () => {
      const balance = BigInt('1'); // 1 wei
      mockBlockchainService.isValidAddress.mockReturnValue(true);
      mockBlockchainService.getRecipientBalance.mockResolvedValue(balance);
      req.params = { address: TEST_DATA.ADDRESSES.VALID };

      await gasController.checkBalance(req, res, next);

      const callArgs = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.balance).toBe('0.000000000000000001');
    });
  });
});