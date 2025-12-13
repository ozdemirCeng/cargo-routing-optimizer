import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { JsonLogger } from './common/logger/json-logger';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const useJsonLogger = String(process.env.LOG_FORMAT ?? '').trim().toLowerCase() === 'json';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: useJsonLogger ? new JsonLogger() : undefined,
  });

  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(compression());

  // Global prefix
  app.setGlobalPrefix('api');

  const configService = app.get(ConfigService);

  // CORS
  const corsOrigin = (configService.get<string>('CORS_ORIGIN') || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new HttpLoggingInterceptor());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Kargo İşletme Sistemi API')
    .setDescription('Kocaeli Üniversitesi Yazılım Lab I - Kargo Rotalama ve Optimizasyon')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT') || 3001;
  await app.listen(port);
  logger.log(`Kargo API running on: http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
