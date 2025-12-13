import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      // Don't crash the whole API if the DB is temporarily unavailable.
      // Readiness endpoint will report unhealthy; requests will fail until DB is reachable.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Prisma connect failed (will continue): ${message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
