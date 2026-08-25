import pino from 'pino';
import { env } from './env';

const isDev = env.NODE_ENV !== 'production';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'swiftcart', env: env.NODE_ENV },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'accessToken',
      'access_token',
      'password',
      'secret',
      'SHOPIFY_API_SECRET',
      'SESSION_SECRET',
      '*.accessToken',
      '*.access_token',
    ],
    remove: true,
  },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, singleLine: false, translateTime: 'SYS:standard' },
        },
      }
    : {}),
});

export type Logger = typeof logger;
