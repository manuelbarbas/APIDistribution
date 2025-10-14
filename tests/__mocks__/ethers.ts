export const mockTransactionResponse = {
  hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  from: '0x1234567890123456789012345678901234567890',
  to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  value: '100000000000000000', // 0.1 ETH in wei
  gasLimit: 21000n,
  gasPrice: '1000000000', // 1 gwei
  nonce: 1,
  confirmations: 0,
  wait: jest.fn(),
  blockNumber: 12345,
  blockHash: '0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
};

export const mockTransactionReceipt = {
  hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  from: '0x1234567890123456789012345678901234567890',
  to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  value: '100000000000000000',
  gasUsed: 21000n,
  status: 1,
  blockNumber: 12345,
  blockHash: '0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
  transactionIndex: 0,
  confirmations: 1,
};

export const mockProvider = {
  getBalance: jest.fn(),
  getBlockNumber: jest.fn(),
  getTransaction: jest.fn(),
  getFeeData: jest.fn(),
  estimateGas: jest.fn(),
};

export const mockWallet = {
  address: '0x1234567890123456789012345678901234567890',
  sendTransaction: jest.fn(),
  estimateGas: jest.fn(),
  getBalance: jest.fn(),
};

export const ethers = {
  JsonRpcProvider: jest.fn(() => mockProvider),
  Wallet: jest.fn(() => mockWallet),
  parseEther: jest.fn((value: string) => {
    const parsed = parseFloat(value);
    return BigInt(parsed * 1e18); // Convert to wei
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
    // Basic address validation for tests
    return typeof address === 'string' && address.length === 42 && address.startsWith('0x');
  }),
};

export default ethers;