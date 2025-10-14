import { envUtils } from '../../utils/test-helpers';

describe('Environment Configuration', () => {
  const envKeys = [
    'NODE_ENV', 'PORT', 'API_KEY', 'PRIVATE_KEY', 'RPC_URL', 'CHAIN_ID',
    'GAS_AMOUNT', 'MINIMUM_BALANCE_THRESHOLD', 'MAX_REQUESTS_PER_MINUTE',
    'MAX_REQUESTS_PER_DAY', 'LOG_LEVEL'
  ];

  beforeEach(() => {
    envUtils.saveEnv(envKeys);
    // Clear the module cache to ensure fresh imports
    jest.resetModules();
  });

  afterEach(() => {
    envUtils.restoreEnv(envKeys);
  });

  describe('Config singleton pattern', () => {
    it('should return the same instance when called multiple times', async () => {
      // Set valid environment
      envUtils.setEnv({
        NODE_ENV: 'test',
        API_KEY: 'test-api-key-32-characters-long-abc123',
        PRIVATE_KEY: '0x1234567890123456789012345678901234567890123456789012345678901234',
      });

      const { config: config1 } = await import('../../../src/config/env.config');
      const { config: config2 } = await import('../../../src/config/env.config');

      expect(config1).toBe(config2);
    });

    it('should have correct default values', async () => {
      envUtils.setEnv({
        API_KEY: 'test-api-key-32-characters-long-abc123',
        PRIVATE_KEY: '0x1234567890123456789012345678901234567890123456789012345678901234',
      });

      const { config } = await import('../../../src/config/env.config');

      expect(config.NODE_ENV).toBe('test');
      expect(config.PORT).toBe(3001);
      expect(config.RPC_URL).toBe('https://testnet-rpc.fair.cloud/');
      expect(config.CHAIN_ID).toBe(935);
      expect(config.GAS_AMOUNT).toBe('0.1');
      expect(config.MINIMUM_BALANCE_THRESHOLD).toBe('0.005');
      expect(config.LOG_LEVEL).toBe('info');
    });
  });

  describe('Environment validation', () => {
    it('should validate NODE_ENV correctly', async () => {
      envUtils.setEnv({
        NODE_ENV: 'production',
        API_KEY: 'test-api-key-32-characters-long-abc123',
        PRIVATE_KEY: '0x1234567890123456789012345678901234567890123456789012345678901234',
      });

      const { config } = await import('../../../src/config/env.config');
      expect(config.NODE_ENV).toBe('production');
    });

    it('should reject invalid NODE_ENV', async () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      envUtils.setEnv({
        NODE_ENV: 'invalid',
        API_KEY: 'test-api-key-32-characters-long-abc123',
        PRIVATE_KEY: '0x1234567890123456789012345678901234567890123456789012345678901234',
      });

      await import('../../../src/config/env.config');

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Environment validation failed:');

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should validate API_KEY length', async () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      envUtils.setEnv({
        API_KEY: 'short', // Less than 32 characters
        PRIVATE_KEY: '0x1234567890123456789012345678901234567890123456789012345678901234',
      });

      await import('../../../src/config/env.config');

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Environment validation failed:');

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should validate PRIVATE_KEY format', async () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      envUtils.setEnv({
        API_KEY: 'test-api-key-32-characters-long-abc123',
        PRIVATE_KEY: '0x123', // Invalid private key
      });

      await import('../../../src/config/env.config');

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Environment validation failed:');

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should validate RPC_URL format', async () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      envUtils.setEnv({
        API_KEY: 'test-api-key-32-characters-long-abc123',
        PRIVATE_KEY: '0x1234567890123456789012345678901234567890123456789012345678901234',
        RPC_URL: 'invalid-url',
      });

      await import('../../../src/config/env.config');

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Environment validation failed:');

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should transform string values to numbers correctly', async () => {
      envUtils.setEnv({
        PORT: '4000',
        CHAIN_ID: '1337',
        MAX_REQUESTS_PER_MINUTE: '20',
        MAX_REQUESTS_PER_DAY: '200',
        API_KEY: 'test-api-key-32-characters-long-abc123',
        PRIVATE_KEY: '0x1234567890123456789012345678901234567890123456789012345678901234',
      });

      const { config } = await import('../../../src/config/env.config');

      expect(config.PORT).toBe(4000);
      expect(config.CHAIN_ID).toBe(1337);
      expect(config.MAX_REQUESTS_PER_MINUTE).toBe(20);
      expect(config.MAX_REQUESTS_PER_DAY).toBe(200);
    });
  });

  describe('Config helper methods', () => {
    it('should correctly identify production environment', async () => {
      envUtils.setEnv({
        NODE_ENV: 'production',
        API_KEY: 'test-api-key-32-characters-long-abc123',
        PRIVATE_KEY: '0x1234567890123456789012345678901234567890123456789012345678901234',
      });

      const configModule = await import('../../../src/config/env.config');
      const configInstance = (configModule as any).Config.getInstance();

      expect(configInstance.isProduction()).toBe(true);
      expect(configInstance.isDevelopment()).toBe(false);
    });

    it('should correctly identify development environment', async () => {
      envUtils.setEnv({
        NODE_ENV: 'development',
        API_KEY: 'test-api-key-32-characters-long-abc123',
        PRIVATE_KEY: '0x1234567890123456789012345678901234567890123456789012345678901234',
      });

      const configModule = await import('../../../src/config/env.config');
      const configInstance = (configModule as any).Config.getInstance();

      expect(configInstance.isProduction()).toBe(false);
      expect(configInstance.isDevelopment()).toBe(true);
    });
  });

  describe('Required environment variables', () => {
    it('should fail when API_KEY is missing', async () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      envUtils.setEnv({
        PRIVATE_KEY: '0x1234567890123456789012345678901234567890123456789012345678901234',
      });
      delete process.env.API_KEY;

      await import('../../../src/config/env.config');

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Environment validation failed:');

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should fail when PRIVATE_KEY is missing', async () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      envUtils.setEnv({
        API_KEY: 'test-api-key-32-characters-long-abc123',
      });
      delete process.env.PRIVATE_KEY;

      await import('../../../src/config/env.config');

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Environment validation failed:');

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });
});