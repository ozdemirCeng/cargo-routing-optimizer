import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log("Prisma connected successfully");
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
