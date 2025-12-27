import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  GatewayTimeoutException,
  Logger,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { StationsService } from "../stations/stations.service";
import { VehiclesService } from "../vehicles/vehicles.service";
import { RoutingService } from "../routing/routing.service";
import { ParametersService } from "../parameters/parameters.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { firstValueFrom } from "rxjs";
import type { AxiosError } from "axios";
import { getRequestId } from "../common/request-context";

type OptimizerResponse = {
  success: boolean;
  summary: {
    total_distance_km: number;
    total_cost: number;
    total_cargos: number;
    total_weight_kg: number;
    vehicles_used: number;
    vehicles_rented: number;
  };
  routes: any[];
  error?: { message?: string };
};

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    private configService: ConfigService,
    private stationsService: StationsService,
    private vehiclesService: VehiclesService,
    private routingService: RoutingService,
    private parametersService: ParametersService
  ) {}

  async findAll(filters?: { status?: string; date?: Date }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.date) {
      const dayStart = new Date(filters.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      where.planDate = { gte: dayStart, lt: dayEnd };
    }

    return this.prisma.plan.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, fullName: true },
        },
        routes: {
          include: {
            vehicle: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, fullName: true },
        },
        routes: {
          include: {
            vehicle: true,
            cargos: {
              include: {
                cargo: {
                  include: {
                    user: { select: { id: true, fullName: true, email: true } },
                    originStation: true,
                  },
                },
              },
            },
          },
          orderBy: { routeOrder: "asc" },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException("Plan not found");
    }

    return plan;
  }

  async create(data: CreatePlanDto, userId: string) {
    // Treat YYYY-MM-DD as a local calendar day (avoid UTC parsing shift).
    const planDate = new Date(`${data.planDate}T00:00:00`);
    if (Number.isNaN(planDate.getTime())) {
      throw new BadRequestException("Geçersiz tarih");
    }
    planDate.setHours(0, 0, 0, 0);

    const dayStart = new Date(planDate);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    // Aynı gün + problem tipi için tekrar plan üretimini engelle
    const existingPlan = await this.prisma.plan.findFirst({
      where: {
        problemType: data.problemType,
        planDate: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true },
    });

    if (existingPlan) {
      throw new ConflictException(
        "Bu tarih ve problem tipi için zaten bir plan var"
      );
    }

    // 1. İstasyon özetini al (o gün için kargo olan istasyonlar)
    const stationSummary =
      await this.stationsService.getStationSummary(planDate);
    const stationsWithCargo = stationSummary.filter(
      (s) => s.cargoCount > 0 && !s.isHub
    );

    if (stationsWithCargo.length === 0) {
      throw new BadRequestException("Bu tarih için kargo bulunmuyor");
    }

    // 2. Hub'u bul
    const hub = await this.stationsService.findHub();
    if (!hub) {
      throw new BadRequestException("Hub istasyonu tanımlı değil");
    }

    // 3. Mevcut araçları al
    const vehicles = await this.vehiclesService.findAvailable();
    if (vehicles.length === 0) {
      throw new BadRequestException("Müsait araç bulunmuyor");
    }

    // 4. Parametreleri al
    const params = await this.parametersService.getAll();
    const costPerKm = data.parameters?.costPerKm || params.cost_per_km || 1;
    const rentalCost =
      data.parameters?.rentalCost || params.rental_cost_500kg || 200;

    // 5. Distance matrix'i hazırla
    const allStationIds = [
      hub.id,
      ...stationsWithCargo.map((s) => s.stationId),
    ];
    const distanceMatrix =
      await this.routingService.getDistanceMatrix(allStationIds);

    // 6. Optimizer input hazırla
    const optimizerInput = {
      plan_date: data.planDate,
      problem_type: data.problemType,
      hub: {
        id: hub.id,
        name: hub.name,
        latitude: Number(hub.latitude),
        longitude: Number(hub.longitude),
      },
      stations: stationsWithCargo.map((s) => ({
        id: s.stationId,
        name: s.stationName,
        code: s.stationCode,
        latitude: s.latitude,
        longitude: s.longitude,
        cargo_count: s.cargoCount,
        total_weight_kg: s.totalWeightKg,
        cargos: s.cargos,
      })),
      vehicles: vehicles.map((v) => ({
        id: v.id,
        name: v.name,
        plate_number: v.plateNumber,
        capacity_kg: Number(v.capacityKg),
        ownership: v.ownership,
        rental_cost: Number(v.rentalCost),
      })),
      parameters: {
        cost_per_km: costPerKm,
        rental_cost: rentalCost,
        rental_capacity_kg: 500,
      },
      distance_matrix: distanceMatrix,
    };

    // 7. Optimizer'ı çağır
    const optimizerUrl =
      this.configService.get<string>("OPTIMIZER_URL") ||
      "http://localhost:5000";
    const optimizerTimeoutMs =
      this.configService.get<number>("OPTIMIZER_TIMEOUT_MS") || 15000;
    let optimizerResult: any;

    try {
      const requestId = getRequestId();
      const response = await firstValueFrom(
        this.httpService.post<OptimizerResponse>(
          `${optimizerUrl}/optimize`,
          optimizerInput,
          {
            timeout: optimizerTimeoutMs,
            headers: requestId ? { "x-request-id": requestId } : undefined,
          }
        )
      );
      optimizerResult = response.data;
    } catch (error) {
      const axiosError = error as AxiosError<any>;
      const detail = (axiosError.response?.data as any)?.detail;
      const message =
        axiosError.message ||
        (error instanceof Error ? error.message : String(error));

      const status = axiosError.response?.status;
      const code = (axiosError as any)?.code as string | undefined;
      this.logger.error(
        "Optimizer error",
        axiosError.response?.data || { status, code, message }
      );

      if (code === "ECONNABORTED") {
        throw new GatewayTimeoutException("Optimizer zaman aşımına uğradı");
      }

      if (!status) {
        throw new ServiceUnavailableException(
          "Optimizer servisine ulaşılamadı"
        );
      }

      if (status >= 500) {
        throw new ServiceUnavailableException("Optimizer servis hatası");
      }

      throw new BadRequestException("Optimizer hatası: " + (detail || message));
    }

    if (!optimizerResult.success) {
      throw new BadRequestException(
        "Optimizasyon başarısız: " + optimizerResult.error?.message
      );
    }

    const allowedCargoIds = new Set(
      stationsWithCargo.flatMap((s) => s.cargos.map((c: any) => c.id))
    );
    const allAssignedCargoIds: string[] = [];
    const seenAssignedCargoIds = new Set<string>();
    for (const route of optimizerResult.routes) {
      for (const assignedCargo of route.assigned_cargos) {
        const cargoId = String(assignedCargo.cargo_id);
        if (!allowedCargoIds.has(cargoId)) {
          throw new BadRequestException(
            "Optimizer beklenmeyen bir kargo döndürdü"
          );
        }
        if (seenAssignedCargoIds.has(cargoId)) {
          throw new BadRequestException(
            "Optimizer aynı kargoyu birden fazla rota için atadı"
          );
        }
        seenAssignedCargoIds.add(cargoId);
        allAssignedCargoIds.push(cargoId);
      }
    }

    // 8-9. Plan + rotalar + atamalar (sequential - PgBouncer uyumlu)
    let planId: string;
    try {
      planId = await this.prisma.$transaction(
        async (tx) => {
        // Optimizer may create rented vehicles on the fly (unlimited_vehicles).
        // Persist them so plan route foreign keys are valid.
        for (const route of optimizerResult.routes) {
          if (!route?.is_rented) continue;

          const vehicleId = String(route.vehicle_id);
          const vehicleName = String(route.vehicle_name || "Kiralık Araç");
          const plateNumber = (`RENT-${vehicleId}`.toUpperCase()).slice(0, 50);

          await tx.vehicle.upsert({
            where: { id: vehicleId },
            update: {
              name: vehicleName,
              ownership: "rented",
              capacityKg: 500,
              rentalCost,
              // These are plan-scoped rented vehicles. Keep them out of the
              // general fleet/availability lists so they don't leak into other plans.
              isActive: false,
              status: "maintenance",
            },
            create: {
              id: vehicleId,
              plateNumber,
              name: vehicleName,
              ownership: "rented",
              capacityKg: 500,
              rentalCost,
              isActive: false,
              status: "maintenance",
            },
          });
        }

        const plan = await tx.plan.create({
          data: {
            planDate,
            problemType: data.problemType,
            status: "draft",
            totalDistanceKm: optimizerResult.summary.total_distance_km,
            totalCost: optimizerResult.summary.total_cost,
            totalCargos: optimizerResult.summary.total_cargos,
            totalWeightKg: optimizerResult.summary.total_weight_kg,
            vehiclesUsed: optimizerResult.summary.vehicles_used,
            vehiclesRented: optimizerResult.summary.vehicles_rented,
            costPerKm,
            rentalCost,
            optimizerResult,
            createdById: userId,
          },
        });

        if (allAssignedCargoIds.length > 0) {
          const updateRes = await tx.cargo.updateMany({
            where: {
              id: { in: allAssignedCargoIds },
              status: "pending",
              scheduledDate: { gte: dayStart, lt: dayEnd },
            },
            data: { status: "assigned" },
          });

          if (updateRes.count !== allAssignedCargoIds.length) {
            throw new ConflictException(
              "Bazı kargolar bu sırada başka bir plana atanmış; tekrar deneyin"
            );
          }
        }

        for (const route of optimizerResult.routes) {
          const planRoute = await tx.planRoute.create({
            data: {
              planId: plan.id,
              vehicleId: route.vehicle_id,
              routeOrder: route.route_order,
              totalDistanceKm: route.total_distance_km,
              totalDurationMin: route.total_duration_minutes,
              totalCost: route.total_cost,
              totalWeightKg: route.total_weight_kg,
              cargoCount: route.cargo_count,
              routeStations: route.route_sequence.map((s: any) => s.station_id),
              routePolyline: route.polyline,
              routeDetails: route.route_sequence,
            },
          });

          if (route.assigned_cargos?.length > 0) {
            await tx.planRouteCargo.createMany({
              data: route.assigned_cargos.map((assignedCargo: any) => ({
                planRouteId: planRoute.id,
                cargoId: assignedCargo.cargo_id,
                pickupOrder: assignedCargo.pickup_order,
              })),
            });
          }

          await tx.trip.create({
            data: {
              planRouteId: planRoute.id,
              vehicleId: route.vehicle_id,
              status: "scheduled",
            },
          });
        }

        return plan.id;
        },
        { timeout: 60000, maxWait: 60000 } // 60 saniye timeout
      );
    } catch (error: any) {
      if (
        error?.constructor?.name === "PrismaClientKnownRequestError" &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Bu tarih ve problem tipi için zaten bir plan var"
        );
      }

      if (
        error?.constructor?.name === "PrismaClientKnownRequestError" &&
        error.code === "P2034"
      ) {
        throw new ConflictException(
          "İşlem çakışması oluştu; lütfen tekrar deneyin"
        );
      }
      throw error;
    }

    return this.findById(planId);
  }

  async activate(id: string) {
    const plan = await this.findById(id);
    if (plan.status !== "draft") {
      throw new BadRequestException("Only draft plans can be activated");
    }

    return this.prisma.plan.update({
      where: { id },
      data: { status: "active" },
    });
  }

  async getRoutes(id: string) {
    const plan = await this.findById(id);
    return plan.routes;
  }

  async delete(id: string) {
    const plan = await this.findById(id);

    const rentedVehicleIds = (plan.routes || [])
      .filter((r) => r.vehicle?.ownership === "rented")
      .map((r) => r.vehicleId);

    // Başlamış seferler varsa silinmez
    const startedTrips = await this.prisma.trip.findMany({
      where: {
        planRoute: { planId: id },
        status: { in: ["in_progress", "completed"] },
      },
    });

    if (startedTrips.length > 0) {
      throw new BadRequestException(
        "Bu plana ait başlamış veya tamamlanmış seferler var, silinemez"
      );
    }

    // Tüm ilişkili kayıtları sil (sırayla)
    // 1. Trips
    await this.prisma.trip.deleteMany({
      where: { planRoute: { planId: id } },
    });

    // 2. PlanRouteCargo (kargo atamaları)
    await this.prisma.planRouteCargo.deleteMany({
      where: { planRoute: { planId: id } },
    });

    // 3. PlanRoutes
    await this.prisma.planRoute.deleteMany({
      where: { planId: id },
    });

    // 4. Kargoları pending'e geri çevir
    const dayStart = new Date(plan.planDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    await this.prisma.cargo.updateMany({
      where: {
        status: "assigned",
        scheduledDate: { gte: dayStart, lt: dayEnd },
      },
      data: { status: "pending" },
    });

    // 5. Plan'ı sil
    await this.prisma.plan.delete({
      where: { id },
    });

    // 6. Clean up plan-scoped rented vehicles that are no longer referenced
    // by any plan route or trip.
    if (rentedVehicleIds.length > 0) {
      await this.prisma.vehicle.deleteMany({
        where: {
          id: { in: rentedVehicleIds },
          ownership: "rented",
          planRoutes: { none: {} },
          trips: { none: {} },
        },
      });
    }

    return { success: true, id };
  }
}
