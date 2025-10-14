/**
 * Demo test to verify Jest setup works correctly
 */

describe('Test Infrastructure Demo', () => {
  it('should run basic Jest tests', () => {
    expect(1 + 1).toBe(2);
    expect('hello').toBeDefined();
    expect(true).toBeTruthy();
  });

  it('should handle async operations', async () => {
    const promise = Promise.resolve('test');
    const result = await promise;
    expect(result).toBe('test');
  });

  it('should work with mocks', () => {
    const mockFn = jest.fn(() => 'mocked result');
    const result = mockFn();
    
    expect(result).toBe('mocked result');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should handle environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should work with BigInt (blockchain values)', () => {
    const weiValue = BigInt('1000000000000000000'); // 1 ETH
    const etherValue = Number(weiValue) / 1e18;
    expect(etherValue).toBe(1);
  });
});

describe('TypeScript Integration', () => {
  interface TestInterface {
    id: number;
    name: string;
  }

  it('should work with TypeScript types', () => {
    const testObj: TestInterface = { id: 1, name: 'test' };
    expect(testObj.id).toBe(1);
    expect(testObj.name).toBe('test');
  });
});

describe('Test Data Constants', () => {
  it('should have access to test constants', () => {
    const testApiKey = 'test-api-key-32-characters-long-abc123';
    const testAddress = '0x742d35Cc6506C5b5b60c96b1c32B6C1e83aA0aEb';
    
    expect(testApiKey.length).toBe(38); // 32+ characters
    expect(testAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});