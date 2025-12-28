import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TripsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: {
    status?: string;
    vehicleId?: string;
    planDate?: string;
    limit?: number;
  }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters?.planDate) {
      // planDate formatı: YYYY-MM-DD
      const dayStart = new Date(`${filters.planDate}T00:00:00`);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      where.planRoute = {
        plan: {
          planDate: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
      };
    }

    // Simplified query for list view - with route info
    return this.prisma.trip.findMany({
      where,
      ...(filters?.limit ? { take: filters.limit } : {}),
      select: {
        id: true,
        status: true,
        actualCost: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        vehicle: {
          select: { id: true, name: true, plateNumber: true, ownership: true },
        },
        planRoute: {
          select: {
            id: true,
            cargoCount: true,
            totalDistanceKm: true,
            totalCost: true,
            totalWeightKg: true,
            routeOrder: true,
            plan: {
              select: { id: true, planDate: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: {
        vehicle: true,
        planRoute: {
          include: {
            plan: true,
            cargos: {
              include: {
                cargo: {
                  include: {
                    user: { select: { id: true, fullName: true } },
                    originStation: true,
                  },
                },
              },
            },
          },
        },
        logs: {
          include: { station: true },
          orderBy: { eventTime: "asc" },
        },
      },
    });

    // routePolyline ve routeDetails ekle
    if (trip?.planRoute) {
      const fullPlanRoute = await this.prisma.planRoute.findUnique({
        where: { id: trip.planRoute.id },
        select: {
          routePolyline: true,
          routeDetails: true,
          routeStations: true,
        },
      });
      if (fullPlanRoute) {
        (trip.planRoute as any).routePolyline = fullPlanRoute.routePolyline;
        (trip.planRoute as any).routeDetails = fullPlanRoute.routeDetails;
        (trip.planRoute as any).routeStations = fullPlanRoute.routeStations;
      }
    }

    if (!trip) {
      throw new NotFoundException("Trip not found");
    }

    return trip;
  }

  async start(id: string) {
    const trip = await this.findById(id);

    // Trip'i başlat
    await this.prisma.trip.update({
      where: { id },
      data: {
        status: "in_progress",
        startedAt: new Date(),
      },
    });

    // Log ekle
    await this.prisma.tripLog.create({
      data: {
        tripId: id,
        eventType: "departed",
        notes: "Sefer başladı",
      },
    });

    // Kargoları in_transit yap
    if (trip.planRoute) {
      for (const prc of trip.planRoute.cargos) {
        await this.prisma.cargo.update({
          where: { id: prc.cargoId },
          data: { status: "in_transit" },
        });
      }
    }

    // Aracı on_route yap
    await this.prisma.vehicle.update({
      where: { id: trip.vehicleId },
      data: { status: "on_route" },
    });

    return this.findById(id);
  }

  async complete(id: string) {
    const trip = await this.findById(id);

    // Süre ve mesafe hesapla
    const startedAt = trip.startedAt || new Date();
    const completedAt = new Date();
    const durationMinutes =
      (completedAt.getTime() - startedAt.getTime()) / 60000;

    // Trip'i tamamla
    await this.prisma.trip.update({
      where: { id },
      data: {
        status: "completed",
        completedAt,
        actualDurationMinutes: durationMinutes,
        actualDistanceKm: trip.planRoute?.totalDistanceKm,
        actualCost: trip.planRoute?.totalCost,
      },
    });

    // Log ekle
    await this.prisma.tripLog.create({
      data: {
        tripId: id,
        eventType: "arrived",
        notes: "Sefer tamamlandı",
      },
    });

    // Kargoları delivered yap
    if (trip.planRoute) {
      for (const prc of trip.planRoute.cargos) {
        await this.prisma.cargo.update({
          where: { id: prc.cargoId },
          data: { status: "delivered" },
        });
      }
    }

    // Aracı available yap
    await this.prisma.vehicle.update({
      where: { id: trip.vehicleId },
      data: { status: "available" },
    });

    return this.findById(id);
  }

  async addLog(
    tripId: string,
    stationId: string | null,
    eventType: string,
    notes?: string
  ) {
    return this.prisma.tripLog.create({
      data: {
        tripId,
        stationId,
        eventType,
        notes,
      },
    });
  }

  async updateStatus(id: string, status: string) {
    await this.findById(id);
    return this.prisma.trip.update({
      where: { id },
      data: { status: status as any },
    });
  }
}
