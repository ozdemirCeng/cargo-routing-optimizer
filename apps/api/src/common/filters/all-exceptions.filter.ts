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

    if (exception instanceof HttpException) {
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
