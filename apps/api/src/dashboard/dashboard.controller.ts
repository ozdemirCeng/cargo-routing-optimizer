import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Genel özet' })
  async getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('cost-analysis')
  @ApiOperation({ summary: 'Maliyet analizi' })
  @ApiQuery({ name: 'planId', required: false })
  async getCostAnalysis(@Query('planId') planId?: string) {
    return this.dashboardService.getCostAnalysis(planId);
  }

  @Get('scenario-comparison')
  @ApiOperation({ summary: 'Senaryo karşılaştırma' })
  @ApiQuery({ name: 'planIds', required: true, type: [String] })
  async getScenarioComparison(@Query('planIds') planIds: string | string[]) {
    const ids = Array.isArray(planIds) ? planIds : [planIds];
    return this.dashboardService.getScenarioComparison(ids);
  }
}
