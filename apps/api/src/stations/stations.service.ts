import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStationDto } from './dto/create-station.dto';
import { UpdateStationDto } from './dto/update-station.dto';

@Injectable()
export class StationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(activeOnly = true) {
    return this.prisma.station.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const station = await this.prisma.station.findUnique({
      where: { id },
    });
    if (!station) {
      throw new NotFoundException('Station not found');
    }
    return station;
  }

  async findHub() {
    return this.prisma.station.findFirst({
      where: { isHub: true, isActive: true },
    });
  }

  async create(data: CreateStationDto, userId: string) {
    return this.prisma.station.create({
      data: {
        name: data.name,
        code: data.code,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
        isHub: data.isHub || false,
        createdById: userId,
      },
    });
  }

  async update(id: string, data: UpdateStationDto) {
    await this.findById(id);
    return this.prisma.station.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.station.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // İstasyon bazlı kargo özeti (ertesi gün planlaması için)
  async getStationSummary(date: Date) {
    const stations = await this.prisma.station.findMany({
      where: { isActive: true },
      include: {
        originCargos: {
          where: {
            status: 'pending',
            scheduledDate: date,
          },
        },
      },
    });

    return stations.map((station) => ({
      stationId: station.id,
      stationName: station.name,
      stationCode: station.code,
      latitude: Number(station.latitude),
      longitude: Number(station.longitude),
      isHub: station.isHub,
      cargoCount: station.originCargos.length,
      totalWeightKg: station.originCargos.reduce(
        (sum, cargo) => sum + Number(cargo.weightKg),
        0,
      ),
      cargos: station.originCargos.map((c) => ({
        id: c.id,
        weightKg: Number(c.weightKg),
        userId: c.userId,
      })),
    }));
  }
}
