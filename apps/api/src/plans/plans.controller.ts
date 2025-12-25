import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { PlansService } from "./plans.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/roles.guard";

@ApiTags("Plans")
@Controller("plans")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PlansController {
  constructor(private plansService: PlansService) {}

  @Get()
  @Roles("admin")
  @ApiOperation({ summary: "Plan listesi (Admin)" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "date", required: false })
  async findAll(
    @Query("status") status?: string,
    @Query("date") date?: string
  ) {
    return this.plansService.findAll({
      status,
      date: date ? new Date(date) : undefined,
    });
  }

  @Get(":id")
  @Roles("admin")
  @ApiOperation({ summary: "Plan detayı" })
  async findOne(@Param("id") id: string) {
    return this.plansService.findById(id);
  }

  @Get(":id/routes")
  @Roles("admin")
  @ApiOperation({ summary: "Plan rotaları (tüm araçlar)" })
  async getRoutes(@Param("id") id: string) {
    return this.plansService.getRoutes(id);
  }

  @Post()
  @Roles("admin")
  @ApiOperation({ summary: "Yeni plan oluştur (Optimizer çalıştır)" })
  async create(@Body() createDto: CreatePlanDto, @Request() req) {
    return this.plansService.create(createDto, req.user.id);
  }

  @Post(":id/activate")
  @Roles("admin")
  @ApiOperation({ summary: "Planı aktifleştir" })
  async activate(@Param("id") id: string) {
    return this.plansService.activate(id);
  }

  @Delete(":id")
  @Roles("admin")
  @ApiOperation({ summary: "Planı sil" })
  async delete(@Param("id") id: string) {
    return this.plansService.delete(id);
  }
}
