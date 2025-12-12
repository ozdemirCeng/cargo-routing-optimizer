import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CargosService } from './cargos.service';
import { CreateCargoDto } from './dto/create-cargo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Cargos')
@Controller('cargos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CargosController {
  constructor(private cargosService: CargosService) {}

  @Get()
  @ApiOperation({ summary: 'Kargoları listele' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'stationId', required: false })
  async findAll(
    @Request() req,
    @Query('status') status?: string,
    @Query('date') date?: string,
    @Query('stationId') stationId?: string,
  ) {
    return this.cargosService.findAll(req.user.id, req.user.role, {
      status,
      date: date ? new Date(date) : undefined,
      stationId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Kargo detayı' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.cargosService.findById(id, req.user.id, req.user.role);
  }

  @Get(':id/route')
  @ApiOperation({ summary: 'Kargonun taşındığı aracın rotası (RBAC)' })
  async getRoute(@Param('id') id: string, @Request() req) {
    return this.cargosService.getCargoRoute(id, req.user.id, req.user.role);
  }

  @Post()
  @ApiOperation({ summary: 'Yeni kargo oluştur' })
  async create(@Body() createDto: CreateCargoDto, @Request() req) {
    return this.cargosService.create(createDto, req.user.id);
  }
}
