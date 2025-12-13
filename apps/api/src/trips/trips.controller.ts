import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@ApiTags('Trips')
@Controller('trips')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('admin')
export class TripsController {
  constructor(private tripsService: TripsService) {}

  @Get()
  @ApiOperation({ summary: 'Sefer listesi' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async findAll(
    @Query('status') status?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.tripsService.findAll({
      status,
      vehicleId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Sefer detayı' })
  async findOne(@Param('id') id: string) {
    return this.tripsService.findById(id);
  }

  @Post(':id/start')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Seferi başlat' })
  async start(@Param('id') id: string) {
    return this.tripsService.start(id);
  }

  @Post(':id/complete')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Seferi tamamla' })
  async complete(@Param('id') id: string) {
    return this.tripsService.complete(id);
  }
}
