import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StationsService } from '../stations/stations.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { RoutingService } from '../routing/routing.service';
import { ParametersService } from '../parameters/parameters.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { firstValueFrom } from 'rxjs';
import type { AxiosError } from 'axios';

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
  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    private configService: ConfigService,
    private stationsService: StationsService,
    private vehiclesService: VehiclesService,
    private routingService: RoutingService,
    private parametersService: ParametersService,
  ) {}

  async findAll(filters?: { status?: string; date?: Date }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.date) where.planDate = filters.date;

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
      orderBy: { createdAt: 'desc' },
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
          orderBy: { routeOrder: 'asc' },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return plan;
  }

  async create(data: CreatePlanDto, userId: string) {
    const planDate = new Date(data.planDate);

    // 1. İstasyon özetini al (o gün için kargo olan istasyonlar)
    const stationSummary = await this.stationsService.getStationSummary(planDate);
    const stationsWithCargo = stationSummary.filter((s) => s.cargoCount > 0 && !s.isHub);

    if (stationsWithCargo.length === 0) {
      throw new BadRequestException('Bu tarih için kargo bulunmuyor');
    }

    // 2. Hub'u bul
    const hub = await this.stationsService.findHub();
    if (!hub) {
      throw new BadRequestException('Hub istasyonu tanımlı değil');
    }

    // 3. Mevcut araçları al
    const vehicles = await this.vehiclesService.findAvailable();
    if (vehicles.length === 0) {
      throw new BadRequestException('Müsait araç bulunmuyor');
    }

    // 4. Parametreleri al
    const params = await this.parametersService.getAll();
    const costPerKm = data.parameters?.costPerKm || params.cost_per_km || 1;
    const rentalCost = data.parameters?.rentalCost || params.rental_cost_500kg || 200;

    // 5. Distance matrix'i hazırla
    const allStationIds = [hub.id, ...stationsWithCargo.map((s) => s.stationId)];
    const distanceMatrix = await this.routingService.getDistanceMatrix(allStationIds);

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
    const optimizerUrl = this.configService.get<string>('OPTIMIZER_URL') || 'http://localhost:5000';
    let optimizerResult: any;

    try {
      const response = await firstValueFrom(
        this.httpService.post<OptimizerResponse>(`${optimizerUrl}/optimize`, optimizerInput),
      );
      optimizerResult = response.data;
    } catch (error) {
      const axiosError = error as AxiosError<any>;
      const detail = (axiosError.response?.data as any)?.detail;
      const message = axiosError.message || (error instanceof Error ? error.message : String(error));
      console.error('Optimizer error:', axiosError.response?.data || message);
      throw new BadRequestException('Optimizer hatası: ' + (detail || message));
    }

    if (!optimizerResult.success) {
      throw new BadRequestException('Optimizasyon başarısız: ' + optimizerResult.error?.message);
    }

    // 8. Plan'ı DB'ye kaydet
    const plan = await this.prisma.plan.create({
      data: {
        planDate,
        problemType: data.problemType,
        status: 'draft',
        totalDistanceKm: optimizerResult.summary.total_distance_km,
        totalCost: optimizerResult.summary.total_cost,
        totalCargos: optimizerResult.summary.total_cargos,
        totalWeightKg: optimizerResult.summary.total_weight_kg,
        vehiclesUsed: optimizerResult.summary.vehicles_used,
        vehiclesRented: optimizerResult.summary.vehicles_rented,
        costPerKm,
        rentalCost,
        optimizerResult: optimizerResult,
        createdById: userId,
      },
    });

    // 9. Rotaları kaydet
    for (const route of optimizerResult.routes) {
      const planRoute = await this.prisma.planRoute.create({
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

      // Kargoları rotaya bağla
      for (const assignedCargo of route.assigned_cargos) {
        await this.prisma.planRouteCargo.create({
          data: {
            planRouteId: planRoute.id,
            cargoId: assignedCargo.cargo_id,
            pickupOrder: assignedCargo.pickup_order,
          },
        });

        // Kargo durumunu güncelle
        await this.prisma.cargo.update({
          where: { id: assignedCargo.cargo_id },
          data: { status: 'assigned' },
        });
      }

      // Trip oluştur
      await this.prisma.trip.create({
        data: {
          planRouteId: planRoute.id,
          vehicleId: route.vehicle_id,
          status: 'scheduled',
        },
      });
    }

    return this.findById(plan.id);
  }

  async activate(id: string) {
    const plan = await this.findById(id);
    if (plan.status !== 'draft') {
      throw new BadRequestException('Only draft plans can be activated');
    }

    return this.prisma.plan.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  async getRoutes(id: string) {
    const plan = await this.findById(id);
    return plan.routes;
  }
}
