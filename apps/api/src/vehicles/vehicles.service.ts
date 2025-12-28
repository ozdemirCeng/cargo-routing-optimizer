import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateVehicleDto } from "./dto/create-vehicle.dto";

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async findAll(activeOnly = true) {
    return this.prisma.vehicle.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { capacityKg: "asc" },
    });
  }

  async findById(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
    });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }
    return vehicle;
  }

  async findAvailable() {
    return this.prisma.vehicle.findMany({
      where: {
        isActive: true,
        status: "available",
      },
      orderBy: { capacityKg: "asc" },
    });
  }

  async create(data: CreateVehicleDto) {
    // Plaka kontrolü
    const existing = await this.prisma.vehicle.findUnique({
      where: { plateNumber: data.plateNumber },
    });
    if (existing) {
      throw new ConflictException(
        `Bu plaka zaten kayıtlı: ${data.plateNumber}`
      );
    }

    return this.prisma.vehicle.create({
      data: {
        plateNumber: data.plateNumber,
        name: data.name,
        capacityKg: data.capacityKg,
        ownership: (data.ownership || "owned") as any,
        rentalCost: data.rentalCost || 0,
        isActive: data.isActive ?? true,
      },
    });
  }

  async createRentalVehicle(capacityKg: number, rentalCost: number) {
    const count = await this.prisma.vehicle.count({
      where: { ownership: "rented" },
    });

    return this.prisma.vehicle.create({
      data: {
        plateNumber: `41 KRL ${String(count + 1).padStart(3, "0")}`,
        name: `Kiralık Araç ${count + 1} (${capacityKg} kg)`,
        capacityKg,
        ownership: "rented",
        rentalCost,
        isActive: true,
      },
    });
  }

  async update(id: string, data: Partial<CreateVehicleDto>) {
    await this.findById(id);

    // Eğer plaka değiştiriliyorsa, başka bir araçta kullanılıp kullanılmadığını kontrol et
    if (data.plateNumber) {
      const existing = await this.prisma.vehicle.findFirst({
        where: {
          plateNumber: data.plateNumber,
          id: { not: id }, // Kendi ID'si hariç
        },
      });
      if (existing) {
        throw new ConflictException(
          `Bu plaka zaten başka bir araçta kayıtlı: ${data.plateNumber}`
        );
      }
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: data as any,
    });
  }

  async delete(id: string) {
    await this.findById(id);
    const [planRouteCount, tripCount] = await Promise.all([
      this.prisma.planRoute.count({ where: { vehicleId: id } }),
      this.prisma.trip.count({ where: { vehicleId: id } }),
    ]);

    if (planRouteCount > 0 || tripCount > 0) {
      return this.prisma.vehicle.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.vehicle.delete({
      where: { id },
    });
  }
}
