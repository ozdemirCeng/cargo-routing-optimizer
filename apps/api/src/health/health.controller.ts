import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }

  @Get('/ready')
  @ApiOperation({ summary: 'Readiness probe (DB connectivity)' })
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready', time: new Date().toISOString() };
  }
}
