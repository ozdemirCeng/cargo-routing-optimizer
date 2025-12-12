import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@ApiTags('Vehicles')
@Controller('vehicles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @Get()
  @ApiOperation({ summary: 'Araçları listele' })
  async findAll() {
    return this.vehiclesService.findAll();
  }

  @Get('available')
  @ApiOperation({ summary: 'Müsait araçları listele' })
  async findAvailable() {
    return this.vehiclesService.findAvailable();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Araç detayı' })
  async findOne(@Param('id') id: string) {
    return this.vehiclesService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Yeni araç ekle (Admin)' })
  async create(@Body() createDto: CreateVehicleDto) {
    return this.vehiclesService.create(createDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Araç güncelle (Admin)' })
  async update(@Param('id') id: string, @Body() updateDto: Partial<CreateVehicleDto>) {
    return this.vehiclesService.update(id, updateDto);
  }
}
