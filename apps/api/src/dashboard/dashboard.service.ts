import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<
      Array<{
        total_cargos: number;
        pending_cargos: number;
        total_vehicles: number;
        active_trips: number;
        today_plans: number;
        total_cost_today: string | number;
      }>
    >`
      SELECT
        (SELECT COUNT(*)::int FROM cargos) AS total_cargos,
        (SELECT COUNT(*)::int FROM cargos WHERE status = 'pending') AS pending_cargos,
        (SELECT COUNT(*)::int FROM vehicles WHERE is_active = TRUE) AS total_vehicles,
        (SELECT COUNT(*)::int FROM trips WHERE status = 'in_progress') AS active_trips,
        (SELECT COUNT(*)::int FROM plans WHERE plan_date >= ${today} AND status IN ('draft','active')) AS today_plans,
        COALESCE((SELECT SUM(COALESCE(actual_cost, 0)) FROM trips WHERE status = 'completed'), 0) AS total_cost_today
    `;

    const r = rows?.[0];
    return {
      totalCargos: r?.total_cargos ?? 0,
      pendingCargos: r?.pending_cargos ?? 0,
      totalVehicles: r?.total_vehicles ?? 0,
      activeTrips: r?.active_trips ?? 0,
      todayPlans: r?.today_plans ?? 0,
      totalCostToday: Number(r?.total_cost_today ?? 0),
    };
  }

  async getCostAnalysis(planId?: string) {
    const where = planId ? { planId } : {};

    const routes = await this.prisma.planRoute.findMany({
      where,
      include: {
        vehicle: true,
        plan: true,
        cargos: {
          include: {
            cargo: {
              include: {
                user: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
        },
      },
    });

    const vehicleCosts = routes.map((route) => {
      const usersMap = new Map<
        string,
        { id: string; fullName: string; email: string }
      >();
      route.cargos.forEach((c) => {
        if (c.cargo.user && !usersMap.has(c.cargo.user.id)) {
          usersMap.set(c.cargo.user.id, c.cargo.user);
        }
      });
      const users = Array.from(usersMap.values());
      return {
        vehicleId: route.vehicleId,
        vehicleName: route.vehicle.name,
        plateNumber: route.vehicle.plateNumber,
        distanceCost:
          Number(route.totalDistanceKm) * Number(route.plan.costPerKm || 1),
        rentalCost:
          route.vehicle.ownership === "rented"
            ? Number(route.vehicle.rentalCost)
            : 0,
        totalCost: Number(route.totalCost),
        cargoCount: route.cargoCount,
        totalWeightKg: Number(route.totalWeightKg),
        capacityUtilization:
          (Number(route.totalWeightKg) / Number(route.vehicle.capacityKg)) *
          100,
        users: users.map((u) => ({
          id: u.id,
          name: u.fullName,
          email: u.email,
        })),
      };
    });

    const totalCost = vehicleCosts.reduce((sum, v) => sum + v.totalCost, 0);

    return {
      planId,
      totalCost,
      vehicleCosts,
    };
  }

  async getScenarioComparison(planIds: string[]) {
    const plans = await this.prisma.plan.findMany({
      where: { id: { in: planIds } },
      include: {
        routes: {
          include: { vehicle: true },
        },
      },
    });

    return plans.map((plan) => ({
      planId: plan.id,
      planDate: plan.planDate,
      problemType: plan.problemType,
      totalCost: Number(plan.totalCost),
      totalDistanceKm: Number(plan.totalDistanceKm),
      totalCargos: plan.totalCargos,
      totalWeightKg: Number(plan.totalWeightKg),
      vehiclesUsed: plan.vehiclesUsed,
      vehiclesRented: plan.vehiclesRented,
      avgCostPerCargo: plan.totalCargos
        ? Number(plan.totalCost) / plan.totalCargos
        : 0,
      avgCostPerKm: Number(plan.totalDistanceKm)
        ? Number(plan.totalCost) / Number(plan.totalDistanceKm)
        : 0,
    }));
  }
}
