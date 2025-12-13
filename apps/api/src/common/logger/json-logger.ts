import type { LoggerService } from '@nestjs/common';
import { getRequestId } from '../request-context';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
}

function normalizeMessage(message: unknown): string {
  if (typeof message === 'string') return message;
  if (message instanceof Error) return message.message;
  return safeStringify(message);
}

export class JsonLogger implements LoggerService {
  private write(level: LogLevel, message: unknown, meta?: Record<string, unknown>) {
    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      pid: process.pid,
      rid: getRequestId(),
      msg: normalizeMessage(message),
      ...meta,
    };

    const line = safeStringify(entry);

    // Keep severity mapping simple: error -> stderr, others -> stdout
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }

  log(message: any, ...optionalParams: any[]) {
    const context = optionalParams?.[0];
    this.write('log', message, context ? { context } : undefined);
  }

  error(message: any, ...optionalParams: any[]) {
    const trace = optionalParams?.[0];
    const context = optionalParams?.[1];

    const meta: Record<string, unknown> = {};
    if (context) meta.context = context;
    if (trace) meta.trace = trace;

    this.write('error', message, Object.keys(meta).length ? meta : undefined);
  }

  warn(message: any, ...optionalParams: any[]) {
    const context = optionalParams?.[0];
    this.write('warn', message, context ? { context } : undefined);
  }

  debug?(message: any, ...optionalParams: any[]) {
    const context = optionalParams?.[0];
    this.write('debug', message, context ? { context } : undefined);
  }

  verbose?(message: any, ...optionalParams: any[]) {
    const context = optionalParams?.[0];
    this.write('verbose', message, context ? { context } : undefined);
  }
}
