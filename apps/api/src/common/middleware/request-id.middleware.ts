import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { runWithRequestContext } from '../request-context';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerValue = req.header('x-request-id');
  const requestId = headerValue && headerValue.trim() ? headerValue.trim() : randomUUID();

  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);

  runWithRequestContext({ requestId }, () => next());
}
