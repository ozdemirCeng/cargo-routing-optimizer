import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ParametersService } from './parameters.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@ApiTags('Parameters')
@Controller('parameters')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ParametersController {
  constructor(private parametersService: ParametersService) {}

  @Get()
  @ApiOperation({ summary: 'Sistem parametrelerini getir' })
  async findAll() {
    return this.parametersService.findAll();
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Parametreleri güncelle (Admin)' })
  async update(@Body() updates: Record<string, number>, @Request() req) {
    return this.parametersService.update(updates, req.user.id);
  }
}
