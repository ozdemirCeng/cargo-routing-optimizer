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

  private getLocalDayRange(date: string | Date) {
    const baseDate =
      typeof date === "string" ? new Date(`${date}T00:00:00`) : new Date(date);

    if (Number.isNaN(baseDate.getTime())) {
      throw new BadRequestException("Geçersiz tarih");
    }

    const dayStart = new Date(baseDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    return { dayStart, dayEnd };
  }

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
      const { dayStart, dayEnd } = this.getLocalDayRange(filters.date);
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

  async findById(idOrTrackingCode: string, userId: string, role: string) {
    // Hem ID hem tracking code ile arama yap
    const isTrackingCode = idOrTrackingCode.startsWith("KRG-");

    const baseWhere = isTrackingCode
      ? { trackingCode: idOrTrackingCode }
      : { id: idOrTrackingCode };

    const where = role === "admin" ? baseWhere : { ...baseWhere, userId };

    const cargo = await this.prisma.cargo.findFirst({
      where,
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

    const scheduledDateParsed = data.scheduledDate
      ? this.getLocalDayRange(String(data.scheduledDate)).dayStart
      : undefined;

    const cargoCount =
      typeof (data as any).cargoCount === "number" &&
      Number.isFinite((data as any).cargoCount)
        ? Math.max(1, Math.trunc((data as any).cargoCount))
        : 1;

    const totalWeightKg = Number(data.weightKg);
    if (!Number.isFinite(totalWeightKg) || totalWeightKg <= 0) {
      throw new BadRequestException("Geçersiz ağırlık");
    }

    // Tek kargo davranışı (geriye uyumluluk)
    if (cargoCount === 1) {
      return this.prisma.cargo.create({
        data: {
          trackingCode: this.generateTrackingCode(),
          userId,
          originStationId: data.originStationId,
          destinationStationId: hub?.id,
          weightKg: data.weightKg,
          description: data.description,
          scheduledDate: scheduledDateParsed,
        },
        include: {
          originStation: true,
        },
      });
    }

    // Toplam ağırlığı N kargoya böl (0.01 kg hassasiyetinde), toplam korunur
    const totalCenti = Math.round(totalWeightKg * 100);
    if (totalCenti < cargoCount) {
      throw new BadRequestException(
        "Toplam ağırlık, kargo adedine göre çok düşük"
      );
    }

    const baseCenti = Math.floor(totalCenti / cargoCount);
    const remainder = totalCenti - baseCenti * cargoCount;
    const weights: number[] = [];
    for (let i = 0; i < cargoCount; i++) {
      const centi = baseCenti + (i < remainder ? 1 : 0);
      weights.push(centi / 100);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const results: any[] = [];
      for (let i = 0; i < weights.length; i++) {
        const w = weights[i];
        const row = await tx.cargo.create({
          data: {
            trackingCode: this.generateTrackingCode(),
            userId,
            originStationId: data.originStationId,
            destinationStationId: hub?.id,
            weightKg: w,
            description: data.description,
            scheduledDate: scheduledDateParsed,
          },
          include: {
            originStation: true,
          },
        });
        results.push(row);
      }
      return results;
    });

    return {
      createdCount: created.length,
      totalWeightKg: Math.round(totalWeightKg * 10) / 10,
      cargos: created,
    };
  }

  // Kargonun taşındığı aracın rotasını getir (RBAC enforced)
  async getCargoRoute(
    cargoIdOrTrackingCode: string,
    userId: string,
    role: string
  ) {
    // Hem ID hem tracking code ile arama yap
    const isTrackingCode = cargoIdOrTrackingCode.startsWith("KRG-");

    const baseWhere = isTrackingCode
      ? { trackingCode: cargoIdOrTrackingCode }
      : { id: cargoIdOrTrackingCode };

    const where = role === "admin" ? baseWhere : { ...baseWhere, userId };

    const cargo = await this.prisma.cargo.findFirst({
      where,
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

    if (!cargo.planRouteCargos.length) {
      return null; // Henüz atanmamış
    }

    const planRoute = cargo.planRouteCargos[0].planRoute;

    // Bu route'a atanmış tüm kargoları alıp durak bazında say/agirlik çıkar
    const routeCargos = await this.prisma.planRouteCargo.findMany({
      where: { planRouteId: planRoute.id },
      include: {
        cargo: {
          select: {
            originStationId: true,
            weightKg: true,
          },
        },
      },
    });

    const stationCargoStats = new Map<
      string,
      { cargoCount: number; totalWeightKg: number }
    >();

    for (const rc of routeCargos) {
      const stationId = rc.cargo.originStationId;
      const weight = Number(rc.cargo.weightKg);
      const current = stationCargoStats.get(stationId) ?? {
        cargoCount: 0,
        totalWeightKg: 0,
      };
      stationCargoStats.set(stationId, {
        cargoCount: current.cargoCount + 1,
        totalWeightKg:
          current.totalWeightKg + (Number.isFinite(weight) ? weight : 0),
      });
    }

    // Route stations'ı çöz
    const stationIds = planRoute.routeStations;
    const stations = await this.prisma.station.findMany({
      where: { id: { in: stationIds } },
      select: {
        id: true,
        name: true,
        code: true,
        latitude: true,
        longitude: true,
        isHub: true,
      },
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
          code: "",
          isHub: false,
          latitude: null,
          longitude: null,
          cargoCount: undefined,
          totalWeightKg: undefined,
        };
      }

      const stats = stationCargoStats.get(station.id);
      const cargoCount = station.isHub ? undefined : stats?.cargoCount;
      const totalWeightKg = station.isHub
        ? undefined
        : stats
          ? Math.round(stats.totalWeightKg * 10) / 10
          : undefined;

      return {
        order: index,
        id: station.id,
        name: station.name,
        code: station.code,
        isHub: station.isHub,
        latitude: station.latitude,
        longitude: station.longitude,
        cargoCount,
        totalWeightKg,
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

    // Prevent scenarios from creating cargos at hub as an origin station.
    // Planning logic excludes hub origins, which would look like 'missing stops'.
    const hubOrigins = stations
      .filter((s) => s.isHub && stationCodes.includes(s.code))
      .map((s) => s.code);
    if (hubOrigins.length > 0) {
      throw new BadRequestException(
        `Senaryo verisinde hub istasyonu kaynak olarak kullanılamaz: ${hubOrigins.join(
          ", "
        )}`
      );
    }

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

    const { dayStart, dayEnd } = this.getLocalDayRange(scheduledDate);

    // Mevcut kargoları temizle (isteğe bağlı)
    if (clearExisting) {
      // IMPORTANT: Clear pending + assigned cargos and detach from planned routes.
      // Otherwise station summaries (pending-only) can look correct while
      // planning uses an incomplete set of cargos.
      await this.clearCargosByDate(scheduledDate);
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
          scheduledDate: dayStart,
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
    const { dayStart, dayEnd } = this.getLocalDayRange(date);

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
    const { dayStart, dayEnd } = this.getLocalDayRange(date);

    const cargosToClear = await this.prisma.cargo.findMany({
      where: {
        scheduledDate: { gte: dayStart, lt: dayEnd },
        status: { in: ["pending", "assigned"] },
      },
      select: { id: true },
    });

    const cargoIds = cargosToClear.map((c) => c.id);
    if (cargoIds.length === 0) {
      return {
        success: true,
        date,
        deletedCount: 0,
      };
    }

    const routeLinks = await this.prisma.planRouteCargo.findMany({
      where: { cargoId: { in: cargoIds } },
      select: { planRouteId: true },
    });

    const affectedPlanRouteIds = Array.from(
      new Set(routeLinks.map((l) => l.planRouteId))
    );

    if (affectedPlanRouteIds.length > 0) {
      const planRoutes = await this.prisma.planRoute.findMany({
        where: { id: { in: affectedPlanRouteIds } },
        select: {
          id: true,
          plan: { select: { status: true } },
          trips: { select: { status: true } },
        },
      });

      const blocked = planRoutes.filter((pr) => {
        const planStatus = pr.plan.status;
        const planAllowsMutation =
          planStatus === "draft" || planStatus === "active";
        const hasStartedTrip = pr.trips.some(
          (t) => t.status === "in_progress" || t.status === "completed"
        );
        return !planAllowsMutation || hasStartedTrip;
      });

      if (blocked.length > 0) {
        throw new BadRequestException(
          "Tamamlanmış/iptal edilmiş planların veya seferi başlamış rotaların kargoları temizlenemez"
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Önce plan rotalarından kargo atamalarını kaldır (FK kısıtı + UI'da rotadan kaybolsun)
      await tx.planRouteCargo.deleteMany({
        where: { cargoId: { in: cargoIds } },
      });

      // Etkilenen rotalara bağlı (başlamamış) seferleri temizle ki boş rota/plan silme takılmasın
      if (affectedPlanRouteIds.length > 0) {
        await tx.trip.deleteMany({
          where: {
            planRouteId: { in: affectedPlanRouteIds },
            status: { notIn: ["in_progress", "completed"] },
          },
        });
      }

      // Ardından kargoları sil
      const deleteRes = await tx.cargo.deleteMany({
        where: { id: { in: cargoIds } },
      });

      if (affectedPlanRouteIds.length > 0) {
        // Kalan kargo atamalarını ve ağırlıkları yeniden hesapla
        const remainingAssignments = await tx.planRouteCargo.findMany({
          where: { planRouteId: { in: affectedPlanRouteIds } },
          select: {
            planRouteId: true,
            cargo: { select: { weightKg: true } },
          },
        });

        const routeAgg = new Map<
          string,
          { cargoCount: number; totalWeightKg: number }
        >();
        for (const row of remainingAssignments) {
          const current = routeAgg.get(row.planRouteId) ?? {
            cargoCount: 0,
            totalWeightKg: 0,
          };
          current.cargoCount += 1;
          current.totalWeightKg += Number(row.cargo.weightKg);
          routeAgg.set(row.planRouteId, current);
        }

        // Boş rotaları sil, dolu rotalarda sayıları güncelle
        const planRouteMeta = await tx.planRoute.findMany({
          where: { id: { in: affectedPlanRouteIds } },
          select: { id: true, planId: true },
        });
        const affectedPlanIds = Array.from(
          new Set(planRouteMeta.map((r) => r.planId))
        );

        for (const pr of planRouteMeta) {
          const agg = routeAgg.get(pr.id) ?? {
            cargoCount: 0,
            totalWeightKg: 0,
          };
          if (agg.cargoCount === 0) {
            await tx.planRoute.delete({ where: { id: pr.id } });
          } else {
            await tx.planRoute.update({
              where: { id: pr.id },
              data: {
                cargoCount: agg.cargoCount,
                totalWeightKg: agg.totalWeightKg,
              },
            });
          }
        }

        // Plan toplamlarını güncelle (kalan route'lardan türet)
        for (const planId of affectedPlanIds) {
          const routes = await tx.planRoute.findMany({
            where: { planId },
            select: {
              totalDistanceKm: true,
              totalCost: true,
              cargoCount: true,
              totalWeightKg: true,
              vehicle: { select: { ownership: true } },
            },
          });

          if (routes.length === 0) {
            await tx.plan.delete({ where: { id: planId } });
            continue;
          }

          const totals = routes.reduce(
            (acc, r) => {
              acc.totalDistanceKm += Number(r.totalDistanceKm);
              acc.totalCost += Number(r.totalCost);
              acc.totalCargos += r.cargoCount;
              acc.totalWeightKg += Number(r.totalWeightKg);
              acc.vehiclesUsed += 1;
              if (r.vehicle.ownership === "rented") acc.vehiclesRented += 1;
              return acc;
            },
            {
              totalDistanceKm: 0,
              totalCost: 0,
              totalCargos: 0,
              totalWeightKg: 0,
              vehiclesUsed: 0,
              vehiclesRented: 0,
            }
          );

          await tx.plan.update({
            where: { id: planId },
            data: {
              totalDistanceKm: totals.totalDistanceKm,
              totalCost: totals.totalCost,
              totalCargos: totals.totalCargos,
              totalWeightKg: totals.totalWeightKg,
              vehiclesUsed: totals.vehiclesUsed,
              vehiclesRented: totals.vehiclesRented,
            },
          });
        }
      }

      return deleteRes;
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
      include: {
        planRouteCargos: {
          select: {
            planRouteId: true,
            planRoute: {
              select: {
                planId: true,
                plan: { select: { status: true } },
                trips: { select: { status: true } },
              },
            },
          },
        },
      },
    });

    if (!cargo) {
      throw new NotFoundException("Kargo bulunamadı");
    }

    // pending/cancelled direkt silinebilir. assigned ise sadece draft planlarda ve sefer başlamadıysa silinebilir.
    if (
      cargo.status !== "pending" &&
      cargo.status !== "cancelled" &&
      cargo.status !== "assigned"
    ) {
      throw new BadRequestException(
        "Sadece bekleyen, iptal edilmiş veya (taslak plandaki) atanmış kargolar silinebilir"
      );
    }

    if (cargo.status === "assigned" && cargo.planRouteCargos.length === 0) {
      throw new BadRequestException(
        "Bu kargo atanmış durumda, fakat rotası bulunamadı"
      );
    }

    const affectedPlanRouteIds = cargo.planRouteCargos.map(
      (x) => x.planRouteId
    );
    const affectedPlanIds = Array.from(
      new Set(cargo.planRouteCargos.map((x) => x.planRoute.planId))
    );

    if (cargo.planRouteCargos.length > 0) {
      const blocked = cargo.planRouteCargos.some((x) => {
        const planStatus = x.planRoute.plan.status;
        const planAllowsMutation =
          planStatus === "draft" || planStatus === "active";
        const hasStartedTrip = x.planRoute.trips.some(
          (t) => t.status === "in_progress" || t.status === "completed"
        );
        return !planAllowsMutation || hasStartedTrip;
      });
      if (blocked) {
        throw new BadRequestException(
          "Tamamlanmış/iptal edilmiş planlarda veya seferi başlamış rotalarda kargo silinemez"
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (affectedPlanRouteIds.length > 0) {
        await tx.trip.deleteMany({
          where: {
            planRouteId: { in: affectedPlanRouteIds },
            status: { notIn: ["in_progress", "completed"] },
          },
        });
        await tx.planRouteCargo.deleteMany({ where: { cargoId: id } });
      }

      await tx.cargo.delete({ where: { id } });

      if (affectedPlanRouteIds.length > 0) {
        const remainingAssignments = await tx.planRouteCargo.findMany({
          where: { planRouteId: { in: affectedPlanRouteIds } },
          select: {
            planRouteId: true,
            cargo: { select: { weightKg: true } },
          },
        });

        const routeAgg = new Map<
          string,
          { cargoCount: number; totalWeightKg: number }
        >();
        for (const row of remainingAssignments) {
          const current = routeAgg.get(row.planRouteId) ?? {
            cargoCount: 0,
            totalWeightKg: 0,
          };
          current.cargoCount += 1;
          current.totalWeightKg += Number(row.cargo.weightKg);
          routeAgg.set(row.planRouteId, current);
        }

        for (const planRouteId of affectedPlanRouteIds) {
          const agg = routeAgg.get(planRouteId) ?? {
            cargoCount: 0,
            totalWeightKg: 0,
          };
          if (agg.cargoCount === 0) {
            await tx.planRoute.delete({ where: { id: planRouteId } });
          } else {
            await tx.planRoute.update({
              where: { id: planRouteId },
              data: {
                cargoCount: agg.cargoCount,
                totalWeightKg: agg.totalWeightKg,
              },
            });
          }
        }

        for (const planId of affectedPlanIds) {
          const routes = await tx.planRoute.findMany({
            where: { planId },
            select: {
              totalDistanceKm: true,
              totalCost: true,
              cargoCount: true,
              totalWeightKg: true,
              vehicle: { select: { ownership: true } },
            },
          });

          if (routes.length === 0) {
            await tx.plan.delete({ where: { id: planId } });
            continue;
          }

          const totals = routes.reduce(
            (acc, r) => {
              acc.totalDistanceKm += Number(r.totalDistanceKm);
              acc.totalCost += Number(r.totalCost);
              acc.totalCargos += r.cargoCount;
              acc.totalWeightKg += Number(r.totalWeightKg);
              acc.vehiclesUsed += 1;
              if (r.vehicle.ownership === "rented") acc.vehiclesRented += 1;
              return acc;
            },
            {
              totalDistanceKm: 0,
              totalCost: 0,
              totalCargos: 0,
              totalWeightKg: 0,
              vehiclesUsed: 0,
              vehiclesRented: 0,
            }
          );

          await tx.plan.update({
            where: { id: planId },
            data: {
              totalDistanceKm: totals.totalDistanceKm,
              totalCost: totals.totalCost,
              totalCargos: totals.totalCargos,
              totalWeightKg: totals.totalWeightKg,
              vehiclesUsed: totals.vehiclesUsed,
              vehiclesRented: totals.vehiclesRented,
            },
          });
        }
      }
    });

    return { success: true, id };
  }
}
