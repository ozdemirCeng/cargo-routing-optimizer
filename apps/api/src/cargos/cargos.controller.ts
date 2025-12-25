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
import { CargosService } from "./cargos.service";
import { CreateCargoDto } from "./dto/create-cargo.dto";
import { LoadScenarioDto } from "./dto/load-scenario.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/roles.guard";

@ApiTags("Cargos")
@Controller("cargos")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CargosController {
  constructor(private cargosService: CargosService) {}

  @Get()
  @ApiOperation({ summary: "Kargoları listele" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "date", required: false })
  @ApiQuery({ name: "stationId", required: false })
  async findAll(
    @Request() req,
    @Query("status") status?: string,
    @Query("date") date?: string,
    @Query("stationId") stationId?: string
  ) {
    return this.cargosService.findAll(req.user.id, req.user.role, {
      status,
      date: date ? new Date(date) : undefined,
      stationId,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Kargo detayı" })
  async findOne(@Param("id") id: string, @Request() req) {
    return this.cargosService.findById(id, req.user.id, req.user.role);
  }

  @Get(":id/route")
  @ApiOperation({ summary: "Kargonun taşındığı aracın rotası (RBAC)" })
  async getRoute(@Param("id") id: string, @Request() req) {
    return this.cargosService.getCargoRoute(id, req.user.id, req.user.role);
  }

  @Post()
  @ApiOperation({ summary: "Yeni kargo oluştur" })
  async create(@Body() createDto: CreateCargoDto, @Request() req) {
    return this.cargosService.create(createDto, req.user.id);
  }

  @Post("load-scenario")
  @UseGuards(RolesGuard)
  @Roles("admin")
  @ApiOperation({ summary: "Senaryo verilerini yükle (Admin)" })
  async loadScenario(@Body() loadScenarioDto: LoadScenarioDto, @Request() req) {
    return this.cargosService.loadScenario(loadScenarioDto, req.user.id);
  }

  @Get("summary/:date")
  @UseGuards(RolesGuard)
  @Roles("admin")
  @ApiOperation({ summary: "Belirli tarihteki kargo özeti (Admin)" })
  async getCargoSummary(@Param("date") date: string) {
    return this.cargosService.getCargoSummaryByDate(date);
  }

  @Delete("clear/:date")
  @UseGuards(RolesGuard)
  @Roles("admin")
  @ApiOperation({ summary: "Belirli tarihteki bekleyen kargoları sil (Admin)" })
  async clearCargosByDate(@Param("date") date: string) {
    return this.cargosService.clearCargosByDate(date);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("admin")
  @ApiOperation({ summary: "Kargo sil (Admin)" })
  async deleteCargo(@Param("id") id: string) {
    return this.cargosService.deleteCargo(id);
  }
}
