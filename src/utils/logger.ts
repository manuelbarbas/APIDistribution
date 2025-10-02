import winston from 'winston';
import { config } from '../config/env.config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Custom log format
 */
const customFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  
  if (Object.keys(meta).length) {
    log += ` ${JSON.stringify(meta)}`;
  }
  
  if (stack) {
    log += `\n${stack}`;
  }
  
  return log;
});

/**
 * Logger configuration
 */
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    customFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
      ),
    }),
    ...(config.NODE_ENV === 'production'
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
          }),
        ]
      : []),
  ],
});

export default logger;