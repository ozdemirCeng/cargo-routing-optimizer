import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TripsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: {
    status?: string;
    vehicleId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    return this.prisma.trip.findMany({
      where,
      include: {
        vehicle: true,
        planRoute: {
          include: {
            plan: true,
          },
        },
        logs: {
          include: { station: true },
          orderBy: { eventTime: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
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
          orderBy: { eventTime: 'asc' },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    return trip;
  }

  async start(id: string) {
    const trip = await this.findById(id);

    // Trip'i başlat
    await this.prisma.trip.update({
      where: { id },
      data: {
        status: 'in_progress',
        startedAt: new Date(),
      },
    });

    // Log ekle
    await this.prisma.tripLog.create({
      data: {
        tripId: id,
        eventType: 'departed',
        notes: 'Sefer başladı',
      },
    });

    // Kargoları in_transit yap
    if (trip.planRoute) {
      for (const prc of trip.planRoute.cargos) {
        await this.prisma.cargo.update({
          where: { id: prc.cargoId },
          data: { status: 'in_transit' },
        });
      }
    }

    // Aracı on_route yap
    await this.prisma.vehicle.update({
      where: { id: trip.vehicleId },
      data: { status: 'on_route' },
    });

    return this.findById(id);
  }

  async complete(id: string) {
    const trip = await this.findById(id);

    // Süre ve mesafe hesapla
    const startedAt = trip.startedAt || new Date();
    const completedAt = new Date();
    const durationMinutes = (completedAt.getTime() - startedAt.getTime()) / 60000;

    // Trip'i tamamla
    await this.prisma.trip.update({
      where: { id },
      data: {
        status: 'completed',
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
        eventType: 'arrived',
        notes: 'Sefer tamamlandı',
      },
    });

    // Kargoları delivered yap
    if (trip.planRoute) {
      for (const prc of trip.planRoute.cargos) {
        await this.prisma.cargo.update({
          where: { id: prc.cargoId },
          data: { status: 'delivered' },
        });
      }
    }

    // Aracı available yap
    await this.prisma.vehicle.update({
      where: { id: trip.vehicleId },
      data: { status: 'available' },
    });

    return this.findById(id);
  }

  async addLog(tripId: string, stationId: string | null, eventType: string, notes?: string) {
    return this.prisma.tripLog.create({
      data: {
        tripId,
        stationId,
        eventType,
        notes,
      },
    });
  }
}
