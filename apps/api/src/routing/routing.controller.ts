import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RoutingService } from './routing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@ApiTags('Routing')
@Controller('routing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RoutingController {
  constructor(private routingService: RoutingService) {}

  @Get('distance')
  @ApiOperation({ summary: 'İki istasyon arası mesafe' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  async getDistance(@Query('from') from: string, @Query('to') to: string) {
    return this.routingService.getDistance(from, to);
  }

  @Post('matrix')
  @ApiOperation({ summary: 'Mesafe matrisi hesapla' })
  async getMatrix(@Body() body: { stationIds: string[] }) {
    return this.routingService.getDistanceMatrix(body.stationIds);
  }

  @Post('refresh-cache')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Mesafe cache yenile (Admin)' })
  async refreshCache() {
    return this.routingService.refreshCache();
  }
}
