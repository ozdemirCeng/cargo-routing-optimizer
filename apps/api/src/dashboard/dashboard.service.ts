import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalCargos,
      pendingCargos,
      totalVehicles,
      activeTrips,
      todayPlans,
      completedTrips,
    ] = await Promise.all([
      this.prisma.cargo.count(),
      this.prisma.cargo.count({ where: { status: "pending" } }),
      this.prisma.vehicle.count({ where: { isActive: true } }),
      this.prisma.trip.count({ where: { status: "in_progress" } }),
      this.prisma.plan.count({
        where: {
          planDate: { gte: today },
          status: { in: ["draft", "active"] },
        },
      }),
      this.prisma.trip.findMany({
        where: { status: "completed" },
        select: { actualCost: true },
      }),
    ]);

    const totalCostToday = completedTrips.reduce(
      (sum, t) => sum + Number(t.actualCost || 0),
      0
    );

    return {
      totalCargos,
      pendingCargos,
      totalVehicles,
      activeTrips,
      todayPlans,
      totalCostToday,
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
