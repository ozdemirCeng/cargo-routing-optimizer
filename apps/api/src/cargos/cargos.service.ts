import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCargoDto } from "./dto/create-cargo.dto";
import { LoadScenarioDto } from "./dto/load-scenario.dto";

@Injectable()
export class CargosService {
  constructor(private prisma: PrismaService) {}

  // Tracking code generator
  private generateTrackingCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "KRG-";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async findAll(
    userId: string,
    role: string,
    filters?: {
      status?: string;
      date?: Date;
      stationId?: string;
    }
  ) {
    const where: any = {};

    // RBAC: User sadece kendi kargolarını görür
    if (role !== "admin") {
      where.userId = userId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.date) {
      const dayStart = new Date(filters.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      where.scheduledDate = { gte: dayStart, lt: dayEnd };
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
      orderBy: { createdAt: "desc" },
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
      throw new NotFoundException("Cargo not found");
    }

    // RBAC: User sadece kendi kargosunu görebilir
    if (role !== "admin" && cargo.userId !== userId) {
      throw new ForbiddenException("Access denied");
    }

    return cargo;
  }

  async create(data: CreateCargoDto, userId: string) {
    // Verify station exists
    const station = await this.prisma.station.findUnique({
      where: { id: data.originStationId },
    });
    if (!station || !station.isActive) {
      throw new NotFoundException("Station not found");
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
        scheduledDate: data.scheduledDate
          ? new Date(data.scheduledDate)
          : undefined,
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
      throw new NotFoundException("Cargo not found");
    }

    // RBAC: User sadece kendi kargosunun rotasını görebilir
    if (role !== "admin" && cargo.userId !== userId) {
      throw new ForbiddenException("Bu kargo size ait değil");
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

    type StationType = (typeof stations)[number];
    const stationMap = new Map<string, StationType>(
      stations.map((s) => [s.id, s])
    );
    const orderedStations = stationIds.map((id, index) => {
      const station = stationMap.get(id);
      if (!station) {
        return {
          order: index,
          id,
          name: "Unknown",
          latitude: null,
          longitude: null,
        };
      }
      return {
        order: index,
        id: station.id,
        name: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
      };
    });

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

  // Senaryo verilerini yükle - toplu kargo oluşturma
  async loadScenario(data: LoadScenarioDto, userId: string) {
    const {
      scenarioId,
      scenarioName,
      scheduledDate,
      data: scenarioData,
      clearExisting,
    } = data;

    // İstasyonları bul
    const stationCodes = scenarioData.map((item) => item.stationCode);
    const stations = await this.prisma.station.findMany({
      where: { code: { in: stationCodes }, isActive: true },
    });

    const stationMap = new Map(stations.map((s) => [s.code, s]));

    // Eksik istasyonları kontrol et
    const missingCodes = stationCodes.filter((code) => !stationMap.has(code));
    if (missingCodes.length > 0) {
      throw new BadRequestException(
        `İstasyonlar bulunamadı: ${missingCodes.join(", ")}`
      );
    }

    // Hub'u bul (destination)
    const hub = await this.prisma.station.findFirst({
      where: { isHub: true, isActive: true },
    });

    if (!hub) {
      throw new BadRequestException("Merkez depo (hub) bulunamadı");
    }

    const scheduledDateObj = new Date(scheduledDate);

    // Mevcut kargoları temizle (isteğe bağlı)
    if (clearExisting) {
      await this.prisma.cargo.deleteMany({
        where: {
          scheduledDate: {
            gte: new Date(scheduledDateObj.setHours(0, 0, 0, 0)),
            lt: new Date(scheduledDateObj.setHours(23, 59, 59, 999)),
          },
          status: "pending", // Sadece bekleyen kargoları sil
        },
      });
    }

    // Kargoları oluştur
    const cargosToCreate: any[] = [];

    for (const item of scenarioData) {
      const station = stationMap.get(item.stationCode)!;
      const weightPerCargo = item.weight / item.count;

      for (let i = 0; i < item.count; i++) {
        cargosToCreate.push({
          trackingCode: this.generateTrackingCode(),
          userId,
          originStationId: station.id,
          destinationStationId: hub.id,
          weightKg: parseFloat(weightPerCargo.toFixed(2)),
          description: `${scenarioName} - ${station.name} #${i + 1}`,
          scheduledDate: new Date(scheduledDate),
          status: "pending",
        });
      }
    }

    // Toplu oluşturma
    const result = await this.prisma.cargo.createMany({
      data: cargosToCreate,
    });

    // İstatistikleri hesapla
    const totalWeight = scenarioData.reduce(
      (sum, item) => sum + item.weight,
      0
    );
    const totalCargos = scenarioData.reduce((sum, item) => sum + item.count, 0);

    return {
      success: true,
      scenarioId,
      scenarioName,
      scheduledDate,
      createdCount: result.count,
      totalWeight,
      totalCargos,
      stationsUsed: scenarioData.length,
    };
  }

  // Belirli tarihteki kargoların özet istatistiklerini getir
  async getCargoSummaryByDate(date: string) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const cargos = await this.prisma.cargo.findMany({
      where: {
        scheduledDate: { gte: dayStart, lt: dayEnd },
      },
      include: {
        originStation: true,
      },
    });

    // İstasyon bazında gruplama
    const byStation = cargos.reduce(
      (acc, cargo) => {
        const stationId = cargo.originStationId;
        if (!acc[stationId]) {
          acc[stationId] = {
            stationId,
            stationName: cargo.originStation.name,
            stationCode: cargo.originStation.code,
            count: 0,
            totalWeight: 0,
          };
        }
        acc[stationId].count++;
        acc[stationId].totalWeight += Number(cargo.weightKg);
        return acc;
      },
      {} as Record<string, any>
    );

    return {
      date,
      totalCargos: cargos.length,
      totalWeight: cargos.reduce((sum, c) => sum + Number(c.weightKg), 0),
      byStation: Object.values(byStation),
    };
  }

  // Belirli tarihteki bekleyen kargoları sil
  async clearCargosByDate(date: string) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    // Sadece pending (bekleyen) kargoları sil - assigned, in_transit, delivered olanları silme
    const result = await this.prisma.cargo.deleteMany({
      where: {
        scheduledDate: { gte: dayStart, lt: dayEnd },
        status: "pending",
      },
    });

    return {
      success: true,
      date,
      deletedCount: result.count,
    };
  }

  // Tekil kargo silme
  async deleteCargo(id: string) {
    const cargo = await this.prisma.cargo.findUnique({
      where: { id },
    });

    if (!cargo) {
      throw new NotFoundException("Kargo bulunamadı");
    }

    // Sadece pending veya cancelled durumundaki kargolar silinebilir
    if (cargo.status !== "pending" && cargo.status !== "cancelled") {
      throw new BadRequestException(
        "Sadece bekleyen veya iptal edilmiş kargolar silinebilir"
      );
    }

    await this.prisma.cargo.delete({
      where: { id },
    });

    return { success: true, id };
  }
}
