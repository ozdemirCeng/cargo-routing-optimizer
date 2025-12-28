import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { TripsService } from "./trips.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/roles.guard";

@ApiTags("Trips")
@Controller("trips")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles("admin")
export class TripsController {
  constructor(private tripsService: TripsService) {}

  @Get()
  @ApiOperation({ summary: "Sefer listesi" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "vehicleId", required: false })
  @ApiQuery({
    name: "planDate",
    required: false,
    description: "Plan tarihi (YYYY-MM-DD)",
  })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async findAll(
    @Query("status") status?: string,
    @Query("vehicleId") vehicleId?: string,
    @Query("planDate") planDate?: string,
    @Query("limit") limit?: string
  ) {
    return this.tripsService.findAll({
      status,
      vehicleId,
      planDate: planDate || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Sefer detayı" })
  async findOne(@Param("id") id: string) {
    return this.tripsService.findById(id);
  }

  @Post(":id/start")
  @UseGuards(RolesGuard)
  @Roles("admin")
  @ApiOperation({ summary: "Seferi başlat" })
  async start(@Param("id") id: string) {
    return this.tripsService.start(id);
  }

  @Post(":id/complete")
  @UseGuards(RolesGuard)
  @Roles("admin")
  @ApiOperation({ summary: "Seferi tamamla" })
  async complete(@Param("id") id: string) {
    return this.tripsService.complete(id);
  }

  @Patch(":id/status")
  @UseGuards(RolesGuard)
  @Roles("admin")
  @ApiOperation({ summary: "Sefer durumunu güncelle" })
  async updateStatus(
    @Param("id") id: string,
    @Body() body: { status: string }
  ) {
    return this.tripsService.updateStatus(id, body.status);
  }
}
