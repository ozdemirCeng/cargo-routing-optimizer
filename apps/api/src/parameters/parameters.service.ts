import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParametersService {
  constructor(private prisma: PrismaService) {}

  async getAll(): Promise<Record<string, number>> {
    const params = await this.prisma.systemParameter.findMany();
    return params.reduce(
      (acc, p) => ({
        ...acc,
        [p.paramKey]: Number(p.paramValue),
      }),
      {},
    );
  }

  async findAll() {
    return this.prisma.systemParameter.findMany({
      orderBy: { paramKey: 'asc' },
    });
  }

  async update(updates: Record<string, number>, userId: string) {
    const results = [];

    for (const [key, value] of Object.entries(updates)) {
      const result = await this.prisma.systemParameter.upsert({
        where: { paramKey: key },
        update: {
          paramValue: value,
          updatedById: userId,
        },
        create: {
          paramKey: key,
          paramValue: value,
          updatedById: userId,
        },
      });
      results.push(result);
    }

    return results;
  }
}
