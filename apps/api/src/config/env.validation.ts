type NodeEnv = 'development' | 'test' | 'production';

export type EnvConfig = {
  NODE_ENV: NodeEnv;
  PORT: number;

  DATABASE_URL: string;
  DIRECT_URL?: string;

  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  OPTIMIZER_URL: string;
  OSRM_URL: string;

  CORS_ORIGIN: string;

  THROTTLE_TTL_SECONDS: number;
  THROTTLE_LIMIT: number;

  ALLOW_HAVERSINE_FALLBACK: boolean;
};

function toNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

function requiredString(value: unknown, key: string): string {
  const str = String(value ?? '').trim();
  if (!str) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return str;
}

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const nodeEnv = (String(config.NODE_ENV ?? 'development') as NodeEnv) || 'development';
  const isProd = nodeEnv === 'production';

  const optimizerUrl = String(config.OPTIMIZER_URL ?? 'http://localhost:5000').trim();
  const osrmUrl = String(config.OSRM_URL ?? 'http://localhost:5001').trim();
  const corsOrigin = String(config.CORS_ORIGIN ?? 'http://localhost:3000').trim();

  if (isProd) {
    // In production we require explicit service URLs.
    if (!String(config.OPTIMIZER_URL ?? '').trim()) {
      throw new Error('Missing required environment variable: OPTIMIZER_URL');
    }
    if (!String(config.OSRM_URL ?? '').trim()) {
      throw new Error('Missing required environment variable: OSRM_URL');
    }
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: toNumber(config.PORT, 3001),

    DATABASE_URL: requiredString(config.DATABASE_URL, 'DATABASE_URL'),
    DIRECT_URL: String(config.DIRECT_URL ?? '').trim() || undefined,

    JWT_SECRET: requiredString(config.JWT_SECRET, 'JWT_SECRET'),
    JWT_EXPIRES_IN: String(config.JWT_EXPIRES_IN ?? '7d').trim() || '7d',

    OPTIMIZER_URL: optimizerUrl,
    OSRM_URL: osrmUrl,

    CORS_ORIGIN: corsOrigin,

    THROTTLE_TTL_SECONDS: toNumber(config.THROTTLE_TTL_SECONDS, 60),
    THROTTLE_LIMIT: toNumber(config.THROTTLE_LIMIT, 120),

    ALLOW_HAVERSINE_FALLBACK: toBoolean(config.ALLOW_HAVERSINE_FALLBACK, false),
  };
}
