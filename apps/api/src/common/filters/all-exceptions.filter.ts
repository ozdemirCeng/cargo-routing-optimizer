import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const timestamp = new Date().toISOString();
    const path = request.url;
    const requestId = request.requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';

    const anyException = exception as any;

    // Normalize DB connectivity failures (Prisma) to 503 without leaking connection details.
    if (
      anyException &&
      (anyException.name === 'PrismaClientInitializationError' ||
        anyException.name === 'PrismaClientUnknownRequestError') &&
      (anyException.errorCode === 'P1001' || anyException.code === 'P1001')
    ) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Database is not reachable';
      error = 'ServiceUnavailable';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resBody = exception.getResponse() as any;

      // Nest can return string or object
      message = resBody?.message ?? exception.message;
      error = resBody?.error ?? exception.name;
    } else if (exception instanceof Error) {
      message = exception.message || message;
      error = exception.name || error;
    }

    // Avoid leaking stack traces by default
    response.status(status).json({
      statusCode: status,
      error,
      message,
      path,
      timestamp,
      requestId,
    });
  }
}
