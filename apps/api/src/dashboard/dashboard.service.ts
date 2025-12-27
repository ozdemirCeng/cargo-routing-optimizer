import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get basic counts
    const rows = await this.prisma.$queryRaw<
      Array<{
        total_cargos: number;
        pending_cargos: number;
        total_vehicles: number;
        active_trips: number;
        today_plans: number;
        completed_trips: number;
      }>
    >`
      SELECT
        (SELECT COUNT(*)::int FROM cargos) AS total_cargos,
        (SELECT COUNT(*)::int FROM cargos WHERE status = 'pending') AS pending_cargos,
        (SELECT COUNT(*)::int FROM vehicles WHERE is_active = TRUE) AS total_vehicles,
        (SELECT COUNT(*)::int FROM trips WHERE status = 'in_progress') AS active_trips,
        (SELECT COUNT(*)::int FROM plans WHERE plan_date >= ${today} AND status IN ('draft','active')) AS today_plans,
        (SELECT COUNT(*)::int FROM trips WHERE status = 'completed') AS completed_trips
    `;

    // Get total cost and distance from plan routes (active/completed plans)
    const costDistanceResult = await this.prisma.$queryRaw<
      Array<{
        total_cost: string | number;
        total_distance: string | number;
        vehicles_used: number;
      }>
    >`
      SELECT 
        COALESCE(SUM(pr.total_cost), 0) AS total_cost,
        COALESCE(SUM(pr.total_distance_km), 0) AS total_distance,
        COUNT(DISTINCT pr.vehicle_id)::int AS vehicles_used
      FROM plan_routes pr
      JOIN plans p ON p.id = pr.plan_id
      WHERE p.status IN ('active', 'completed')
    `;

    // Get average load percentage from plan routes (only routes that have weight)
    const loadResult = await this.prisma.$queryRaw<
      Array<{ avg_load: string | number }>
    >`
      SELECT COALESCE(
        AVG(
          CASE 
            WHEN v.capacity_kg > 0 THEN (pr.total_weight_kg / v.capacity_kg) * 100 
            ELSE 0 
          END
        ), 0
      ) AS avg_load
      FROM plan_routes pr
      JOIN vehicles v ON v.id = pr.vehicle_id
      JOIN plans p ON p.id = pr.plan_id
      WHERE p.status IN ('active', 'completed')
    `;

    // Get vehicle capacity utilization per vehicle (including rented vehicles from plan_routes)
    const vehicleUtilization = await this.prisma.$queryRaw<
      Array<{
        vehicle_id: string;
        vehicle_name: string;
        plate_number: string;
        capacity_kg: number;
        ownership: string;
        total_weight: number;
        utilization: number;
        is_used: boolean;
      }>
    >`
      SELECT 
        pr.vehicle_id,
        v.name as vehicle_name,
        v.plate_number,
        v.capacity_kg,
        v.ownership,
        SUM(pr.total_weight_kg) as total_weight,
        AVG((pr.total_weight_kg / v.capacity_kg) * 100) as utilization,
        true as is_used
      FROM plan_routes pr
      JOIN vehicles v ON v.id = pr.vehicle_id
      JOIN plans p ON p.id = pr.plan_id AND p.status IN ('active', 'completed')
      GROUP BY pr.vehicle_id, v.name, v.plate_number, v.capacity_kg, v.ownership
      ORDER BY utilization DESC
    `;

    const r = rows?.[0];
    const cdr = costDistanceResult?.[0];
    const totalCost = Number(cdr?.total_cost ?? 0);
    const totalDistance = Number(cdr?.total_distance ?? 0);
    const vehiclesUsed = Number(cdr?.vehicles_used ?? 0);
    const avgLoad = Math.round(Number(loadResult?.[0]?.avg_load ?? 0));

    return {
      totalCargos: r?.total_cargos ?? 0,
      pendingCargos: r?.pending_cargos ?? 0,
      totalVehicles: r?.total_vehicles ?? 0,
      activeTrips: r?.active_trips ?? 0,
      completedTrips: r?.completed_trips ?? 0,
      todayPlans: r?.today_plans ?? 0,
      totalCostToday: totalCost,
      totalDistanceToday: totalDistance,
      vehiclesUsed: vehiclesUsed,
      avgLoadPercentage: avgLoad,
      vehicleUtilization: vehicleUtilization.map((v) => ({
        vehicleId: v.vehicle_id,
        vehicleName: v.vehicle_name,
        plateNumber: v.plate_number,
        capacityKg: Number(v.capacity_kg),
        ownership: v.ownership,
        totalWeight: Number(v.total_weight),
        utilization: Math.round(Number(v.utilization)),
        isUsed: v.is_used,
      })),
    };
  }

  async getCostAnalysis(planId?: string) {
    const where = planId ? { planId } : {};

    const routes = await this.prisma.planRoute.findMany({
      where,
      include: {
        vehicle: true,
        plan: {
          select: {
            id: true,
            status: true,
            costPerKm: true,
          },
        },
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

    // Filter only active/completed plans
    const activeRoutes = routes.filter(
      (r) => r.plan.status === "active" || r.plan.status === "completed"
    );

    // Group by vehicle and sum costs
    const vehicleMap = new Map<
      string,
      {
        vehicleId: string;
        vehicleName: string;
        plateNumber: string;
        ownership: string;
        capacityKg: number;
        totalCost: number;
        totalDistanceKm: number;
        totalWeightKg: number;
        cargoCount: number;
        routeCount: number;
        users: Map<string, { id: string; fullName: string; email: string }>;
      }
    >();

    activeRoutes.forEach((route) => {
      const vehicleId = route.vehicleId;
      let existing = vehicleMap.get(vehicleId);

      if (!existing) {
        existing = {
          vehicleId: route.vehicleId,
          vehicleName: route.vehicle.name,
          plateNumber: route.vehicle.plateNumber,
          ownership: route.vehicle.ownership,
          capacityKg: Number(route.vehicle.capacityKg),
          totalCost: 0,
          totalDistanceKm: 0,
          totalWeightKg: 0,
          cargoCount: 0,
          routeCount: 0,
          users: new Map(),
        };
        vehicleMap.set(vehicleId, existing);
      }

      existing.totalCost += Number(route.totalCost);
      existing.totalDistanceKm += Number(route.totalDistanceKm);
      existing.totalWeightKg += Number(route.totalWeightKg);
      existing.cargoCount += route.cargoCount;
      existing.routeCount += 1;

      // Collect unique users
      route.cargos.forEach((c) => {
        if (c.cargo.user && !existing!.users.has(c.cargo.user.id)) {
          existing!.users.set(c.cargo.user.id, c.cargo.user);
        }
      });
    });

    // Convert map to array and calculate derived values
    const vehicleCosts = Array.from(vehicleMap.values())
      .map((v) => ({
        vehicleId: v.vehicleId,
        vehicleName: v.vehicleName,
        plateNumber: v.plateNumber,
        totalCost: v.totalCost,
        totalDistanceKm: v.totalDistanceKm,
        totalWeightKg: v.totalWeightKg,
        cargoCount: v.cargoCount,
        routeCount: v.routeCount,
        capacityUtilization:
          v.capacityKg > 0 ? (v.totalWeightKg / v.capacityKg) * 100 : 0,
        isRented: v.ownership === "rented",
        users: Array.from(v.users.values()).map((u) => ({
          id: u.id,
          name: u.fullName,
          email: u.email,
        })),
      }))
      .sort((a, b) => b.totalCost - a.totalCost); // Sort by cost descending

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
