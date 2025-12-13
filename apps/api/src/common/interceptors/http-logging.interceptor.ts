import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<any>();
    const res = http.getResponse<any>();

    const startedAt = Date.now();
    const requestId = req.requestId;
    const userId = req.user?.id;

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt;
          this.logger.log(
            `${req.method} ${req.originalUrl ?? req.url} ${res.statusCode} ${durationMs}ms` +
              (requestId ? ` rid=${requestId}` : '') +
              (userId ? ` uid=${userId}` : ''),
          );
        },
      }),
    );
  }
}
