import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCargoDto } from './dto/create-cargo.dto';

@Injectable()
export class CargosService {
  constructor(private prisma: PrismaService) {}

  // Tracking code generator
  private generateTrackingCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'KRG-';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async findAll(userId: string, role: string, filters?: {
    status?: string;
    date?: Date;
    stationId?: string;
  }) {
    const where: any = {};

    // RBAC: User sadece kendi kargolarını görür
    if (role !== 'admin') {
      where.userId = userId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.date) {
      where.scheduledDate = filters.date;
    }
    if (filters?.stationId) {
      where.originStationId = filters.stationId;
    }

    return this.prisma.cargo.findMany({
      where,
      include: {
        originStation: true,
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId: string, role: string) {
    const cargo = await this.prisma.cargo.findUnique({
      where: { id },
      include: {
        originStation: true,
        user: {
          select: { id: true, fullName: true, email: true },
        },
        planRouteCargos: {
          include: {
            planRoute: {
              include: {
                vehicle: true,
                plan: true,
              },
            },
          },
        },
      },
    });

    if (!cargo) {
      throw new NotFoundException('Cargo not found');
    }

    // RBAC: User sadece kendi kargosunu görebilir
    if (role !== 'admin' && cargo.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return cargo;
  }

  async create(data: CreateCargoDto, userId: string) {
    // Verify station exists
    const station = await this.prisma.station.findUnique({
      where: { id: data.originStationId },
    });
    if (!station || !station.isActive) {
      throw new NotFoundException('Station not found');
    }

    // Hub'u bul (destination)
    const hub = await this.prisma.station.findFirst({
      where: { isHub: true, isActive: true },
    });

    return this.prisma.cargo.create({
      data: {
        trackingCode: this.generateTrackingCode(),
        userId,
        originStationId: data.originStationId,
        destinationStationId: hub?.id,
        weightKg: data.weightKg,
        description: data.description,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
      },
      include: {
        originStation: true,
      },
    });
  }

  // Kargonun taşındığı aracın rotasını getir (RBAC enforced)
  async getCargoRoute(cargoId: string, userId: string, role: string) {
    const cargo = await this.prisma.cargo.findUnique({
      where: { id: cargoId },
      include: {
        planRouteCargos: {
          include: {
            planRoute: {
              include: {
                vehicle: true,
                plan: true,
              },
            },
          },
        },
      },
    });

    if (!cargo) {
      throw new NotFoundException('Cargo not found');
    }

    // RBAC: User sadece kendi kargosunun rotasını görebilir
    if (role !== 'admin' && cargo.userId !== userId) {
      throw new ForbiddenException('Bu kargo size ait değil');
    }

    if (!cargo.planRouteCargos.length) {
      return null; // Henüz atanmamış
    }

    const planRoute = cargo.planRouteCargos[0].planRoute;
    
    // Route stations'ı çöz
    const stationIds = planRoute.routeStations;
    const stations = await this.prisma.station.findMany({
      where: { id: { in: stationIds } },
    });

    const stationMap = new Map(stations.map(s => [s.id, s]));
    const orderedStations = stationIds.map((id, index) => ({
      order: index,
      ...stationMap.get(id),
    }));

    return {
      vehicleId: planRoute.vehicleId,
      vehicleName: planRoute.vehicle.name,
      polyline: planRoute.routePolyline,
      stations: orderedStations,
      totalDistanceKm: Number(planRoute.totalDistanceKm),
      totalCost: Number(planRoute.totalCost),
    };
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.cargo.update({
      where: { id },
      data: { status: status as any },
    });
  }
}
