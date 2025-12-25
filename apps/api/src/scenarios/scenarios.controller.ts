import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { ApplyScenarioDto } from './dto/apply-scenario.dto';
import { ScenariosService } from './scenarios.service';

@ApiTags('Scenarios')
@Controller('scenarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class ScenariosController {
  constructor(private scenariosService: ScenariosService) {}

  @Get()
  @ApiOperation({ summary: 'Senaryoları listele (Admin)' })
  list() {
    return this.scenariosService.list();
  }

  @Post('apply')
  @ApiOperation({ summary: 'Senaryo uygula: tarih için kargo üret (Admin)' })
  apply(@Body() dto: ApplyScenarioDto) {
    return this.scenariosService.apply(dto);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Tarih için senaryo kargolarını temizle (Admin)' })
  reset(@Body() body: { date: string }) {
    return this.scenariosService.reset(body.date);
  }
}
