import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Environment configuration schema using Zod for runtime validation
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  
  // API Configuration
  API_KEY: z.string().min(32, 'API_KEY must be at least 32 characters'),
  
  // Blockchain Configuration
  PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key format'),
  RPC_URL: z.string().url().default('https://testnet-rpc.fair.cloud/'),
  CHAIN_ID: z.number().default(935),
  
  // Gas Distribution Configuration
  GAS_AMOUNT: z.string().default('0.1'), // Amount in native token
  MINIMUM_BALANCE_THRESHOLD: z.string().default('0.1'), // Minimum balance to skip distribution
  MAX_REQUESTS_PER_MINUTE: z.string().default('10').transform(Number),
  MAX_REQUESTS_PER_DAY: z.string().default('100').transform(Number),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

class Config {
  private static instance: Config;
  private config: EnvConfig;

  private constructor() {
    try {
      this.config = envSchema.parse({
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        API_KEY: process.env.API_KEY,
        PRIVATE_KEY: process.env.PRIVATE_KEY,
        RPC_URL: process.env.RPC_URL,
        CHAIN_ID: Number(process.env.CHAIN_ID) || 935,
        GAS_AMOUNT: process.env.GAS_AMOUNT,
        MINIMUM_BALANCE_THRESHOLD: process.env.MINIMUM_BALANCE_THRESHOLD,
        MAX_REQUESTS_PER_MINUTE: process.env.MAX_REQUESTS_PER_MINUTE,
        MAX_REQUESTS_PER_DAY: process.env.MAX_REQUESTS_PER_DAY,
        LOG_LEVEL: process.env.LOG_LEVEL,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Environment validation failed:');
        console.error(error.format());
        process.exit(1);
      }
      throw error;
    }
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  public get env(): EnvConfig {
    return this.config;
  }

  public isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  public isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }
}

export const config = Config.getInstance().env;