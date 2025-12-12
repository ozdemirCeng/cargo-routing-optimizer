import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleOwnership } from '@prisma/client';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async findAll(activeOnly = true) {
    return this.prisma.vehicle.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { capacityKg: 'asc' },
    });
  }

  async findById(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    return vehicle;
  }

  async findAvailable() {
    return this.prisma.vehicle.findMany({
      where: {
        isActive: true,
        status: 'available',
      },
      orderBy: { capacityKg: 'asc' },
    });
  }

  async create(data: CreateVehicleDto) {
    return this.prisma.vehicle.create({
      data: {
        plateNumber: data.plateNumber,
        name: data.name,
        capacityKg: data.capacityKg,
        ownership: (data.ownership || 'owned') as VehicleOwnership,
        rentalCost: data.rentalCost || 0,
      },
    });
  }

  async createRentalVehicle(capacityKg: number, rentalCost: number) {
    const count = await this.prisma.vehicle.count({
      where: { ownership: 'rented' },
    });
    
    return this.prisma.vehicle.create({
      data: {
        plateNumber: `41 KRL ${String(count + 1).padStart(3, '0')}`,
        name: `Kiralık Araç ${count + 1} (${capacityKg} kg)`,
        capacityKg,
        ownership: 'rented',
        rentalCost,
        isActive: true,
      },
    });
  }

  async update(id: string, data: Partial<CreateVehicleDto>) {
    await this.findById(id);
    return this.prisma.vehicle.update({
      where: { id },
      data,
    });
  }
}
