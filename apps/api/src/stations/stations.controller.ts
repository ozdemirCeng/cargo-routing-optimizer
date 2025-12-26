import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StationsService } from './stations.service';
import { CreateStationDto } from './dto/create-station.dto';
import { UpdateStationDto } from './dto/update-station.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@ApiTags('Stations')
@Controller('stations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StationsController {
  constructor(private stationsService: StationsService) {}

  @Get()
  @ApiOperation({ summary: 'Tüm istasyonları listele' })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  async findAll(@Query('active') active?: string) {
    const activeOnly = active !== 'false';
    return this.stationsService.findAll(activeOnly);
  }

  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'İstasyon kargo özeti (ertesi gün için)' })
  @ApiQuery({ name: 'date', required: true, type: String })
  async getSummary(@Query('date') dateStr: string) {
    return this.stationsService.getStationSummary(dateStr);
  }

  @Get(':id')
  @ApiOperation({ summary: 'İstasyon detayı' })
  async findOne(@Param('id') id: string) {
    return this.stationsService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Yeni istasyon ekle (Admin)' })
  async create(@Body() createDto: CreateStationDto, @Request() req) {
    return this.stationsService.create(createDto, req.user.id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'İstasyon güncelle (Admin)' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateStationDto) {
    return this.stationsService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'İstasyon sil (Admin)' })
  async delete(@Param('id') id: string) {
    return this.stationsService.delete(id);
  }
}
