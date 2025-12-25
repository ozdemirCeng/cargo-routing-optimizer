import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyScenarioDto } from './dto/apply-scenario.dto';
import { getScenarioById, SCENARIOS } from './scenarios.definitions';
import * as bcrypt from 'bcrypt';

function toDayRange(date: Date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { dayStart, dayEnd };
}

function makeTrackingCode(parts: string[]) {
  const rand = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0');
  return [...parts, rand].join('-').toUpperCase();
}

@Injectable()
export class ScenariosService {
  constructor(private prisma: PrismaService) {}

  list() {
    return SCENARIOS.map((s) => ({
      id: s.id,
      name: s.name,
      totals: Object.values(s.stationsByCode).reduce(
        (acc, st) => ({
          cargoCount: acc.cargoCount + st.cargoCount,
          totalWeightKg: acc.totalWeightKg + st.totalWeightKg,
        }),
        { cargoCount: 0, totalWeightKg: 0 },
      ),
    }));
  }

  async apply(dto: ApplyScenarioDto) {
    const scenario = getScenarioById(dto.scenarioId);
    if (!scenario) {
      throw new NotFoundException('Scenario not found');
    }

    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    const { dayStart, dayEnd } = toDayRange(date);

    const hub = await this.prisma.station.findFirst({ where: { isHub: true } });
    if (!hub) {
      throw new BadRequestException('Hub istasyonu tanımlı değil');
    }

    const stationCodes = Object.keys(scenario.stationsByCode);
    const stations = await this.prisma.station.findMany({
      where: { code: { in: stationCodes }, isActive: true },
      select: { id: true, code: true },
    });

    const stationIdByCode = new Map<string, string>(
      stations.map((s) => [s.code, s.id] as const),
    );
    const missingCodes = stationCodes.filter((c) => !stationIdByCode.has(c));
    if (missingCodes.length > 0) {
      throw new BadRequestException(
        `Eksik istasyon kodları: ${missingCodes.join(', ')}`,
      );
    }

    const demoUsers = Math.max(1, dto.demoUsers ?? 1);
    const demoPassword = dto.demoPassword ?? '123456';
    const passwordHash = await bcrypt.hash(demoPassword, 10);

    const users = await Promise.all(
      Array.from({ length: demoUsers }, async (_, idx) => {
        const i = idx + 1;
        const email = `scenario_user_${i}@kargo.com`;
        return this.prisma.user.upsert({
          where: { email },
          update: { isActive: true },
          create: {
            email,
            passwordHash,
            fullName: `Senaryo Kullanıcısı ${i}`,
            role: 'user',
            isActive: true,
          },
          select: { id: true },
        });
      }),
    );

    const cargoRows: {
      trackingCode: string;
      userId: string;
      originStationId: string;
      destinationStationId: string;
      weightKg: number;
      description: string;
      status: 'pending';
      scheduledDate: Date;
    }[] = [];

    const yyyymmdd = dayStart.toISOString().slice(0, 10).replaceAll('-', '');

    for (const [stationCode, input] of Object.entries(scenario.stationsByCode)) {
      const cargoCount = input.cargoCount;
      const totalWeightKg = input.totalWeightKg;
      if (cargoCount <= 0 || totalWeightKg <= 0) continue;

      const originStationId = stationIdByCode.get(stationCode);
      if (!originStationId) {
        // Shouldn't happen because we already validated missing codes
        continue;
      }

      // Distribute weight evenly; last cargo gets the remainder.
      const base = Number((totalWeightKg / cargoCount).toFixed(2));
      const weights = Array.from({ length: cargoCount }, () => base);
      const sumBase = base * cargoCount;
      const remainder = Number((totalWeightKg - sumBase).toFixed(2));
      if (Math.abs(remainder) > 0.001) {
        weights[weights.length - 1] = Number(
          (weights[weights.length - 1] + remainder).toFixed(2),
        );
      }

      for (let i = 0; i < cargoCount; i++) {
        const userId = users[i % users.length].id;
        cargoRows.push({
          trackingCode: makeTrackingCode([
            'SCN',
            String(scenario.id),
            yyyymmdd,
            stationCode,
            String(i + 1),
          ]),
          userId,
          originStationId,
          destinationStationId: hub.id,
          weightKg: weights[i],
          description: `Scenario:${scenario.id}`,
          status: 'pending',
          scheduledDate: dayStart,
        });
      }
    }

    if (cargoRows.length === 0) {
      throw new BadRequestException('Scenario kargo üretmedi');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (dto.replace) {
        await tx.cargo.deleteMany({
          where: {
            scheduledDate: { gte: dayStart, lt: dayEnd },
            description: { startsWith: 'Scenario:' },
          },
        });
      }

      await tx.cargo.createMany({ data: cargoRows });

      return {
        inserted: cargoRows.length,
        totalWeightKg: Number(
          cargoRows.reduce((acc, c) => acc + c.weightKg, 0).toFixed(2),
        ),
      };
    });

    return {
      scenario: { id: scenario.id, name: scenario.name },
      date: dayStart.toISOString().slice(0, 10),
      inserted: result.inserted,
      totalWeightKg: result.totalWeightKg,
      demoUsers: users.length,
      replace: !!dto.replace,
    };
  }

  async reset(dateIso: string) {
    const date = new Date(dateIso);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    const { dayStart, dayEnd } = toDayRange(date);

    const res = await this.prisma.cargo.deleteMany({
      where: {
        scheduledDate: { gte: dayStart, lt: dayEnd },
        description: { startsWith: 'Scenario:' },
      },
    });

    return {
      date: dayStart.toISOString().slice(0, 10),
      deleted: res.count,
    };
  }
}
