import { BadRequestException, ConflictException, GatewayTimeoutException } from '@nestjs/common';
import { throwError, of } from 'rxjs';
import { PlansService } from './plans.service';

describe('PlansService', () => {
  function makeService(overrides?: Partial<any>) {
    const prisma: any = {
      plan: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };

    const httpService: any = {
      post: jest.fn(),
    };

    const configService: any = {
      get: jest.fn((key: string) => {
        if (key === 'OPTIMIZER_URL') return 'http://optimizer';
        if (key === 'OPTIMIZER_TIMEOUT_MS') return 1000;
        return undefined;
      }),
    };

    const stationsService: any = {
      getStationSummary: jest.fn(),
      findHub: jest.fn(),
    };

    const vehiclesService: any = {
      findAvailable: jest.fn(),
    };

    const routingService: any = {
      getDistanceMatrix: jest.fn(),
    };

    const parametersService: any = {
      getAll: jest.fn(),
    };

    const service = new PlansService(
      overrides?.prisma ?? prisma,
      overrides?.httpService ?? httpService,
      overrides?.configService ?? configService,
      overrides?.stationsService ?? stationsService,
      overrides?.vehiclesService ?? vehiclesService,
      overrides?.routingService ?? routingService,
      overrides?.parametersService ?? parametersService,
    );

    return { service, prisma, httpService, configService, stationsService, vehiclesService, routingService, parametersService };
  }

  it('returns 409 when plan already exists for day+problemType', async () => {
    const { service, prisma } = makeService();
    prisma.plan.findFirst.mockResolvedValue({ id: 'plan-1' });

    await expect(
      service.create({ planDate: '2025-12-13', problemType: 'scenario1' } as any, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 504 when optimizer times out', async () => {
    const { service, prisma, stationsService, vehiclesService, routingService, parametersService, httpService } = makeService();

    prisma.plan.findFirst.mockResolvedValue(null);

    stationsService.getStationSummary.mockResolvedValue([
      {
        stationId: 's1',
        stationName: 'S1',
        stationCode: 'S1',
        latitude: 0,
        longitude: 0,
        isHub: false,
        cargoCount: 1,
        totalWeightKg: 10,
        cargos: [{ id: 'c1', weightKg: 10, userId: 'u1' }],
      },
    ]);

    stationsService.findHub.mockResolvedValue({ id: 'hub', name: 'Hub', latitude: 0, longitude: 0 });
    vehiclesService.findAvailable.mockResolvedValue([
      { id: 'v1', name: 'V1', plateNumber: '34ABC34', capacityKg: 500, ownership: 'owned', rentalCost: 0 },
    ]);
    parametersService.getAll.mockResolvedValue({ cost_per_km: 1, rental_cost_500kg: 200 });
    routingService.getDistanceMatrix.mockResolvedValue({});

    httpService.post.mockReturnValue(
      throwError(() => ({ code: 'ECONNABORTED', message: 'timeout' })),
    );

    await expect(
      service.create({ planDate: '2025-12-13', problemType: 'scenario1' } as any, 'user-1'),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);
  });

  it('returns 400 when optimizer returns unsuccessful response', async () => {
    const { service, prisma, stationsService, vehiclesService, routingService, parametersService, httpService } = makeService();

    prisma.plan.findFirst.mockResolvedValue(null);

    stationsService.getStationSummary.mockResolvedValue([
      {
        stationId: 's1',
        stationName: 'S1',
        stationCode: 'S1',
        latitude: 0,
        longitude: 0,
        isHub: false,
        cargoCount: 1,
        totalWeightKg: 10,
        cargos: [{ id: 'c1', weightKg: 10, userId: 'u1' }],
      },
    ]);

    stationsService.findHub.mockResolvedValue({ id: 'hub', name: 'Hub', latitude: 0, longitude: 0 });
    vehiclesService.findAvailable.mockResolvedValue([
      { id: 'v1', name: 'V1', plateNumber: '34ABC34', capacityKg: 500, ownership: 'owned', rentalCost: 0 },
    ]);
    parametersService.getAll.mockResolvedValue({ cost_per_km: 1, rental_cost_500kg: 200 });
    routingService.getDistanceMatrix.mockResolvedValue({});

    httpService.post.mockReturnValue(
      of({
        data: {
          success: false,
          summary: {
            total_distance_km: 0,
            total_cost: 0,
            total_cargos: 0,
            total_weight_kg: 0,
            vehicles_used: 0,
            vehicles_rented: 0,
          },
          routes: [],
          error: { message: 'bad input' },
        },
      }),
    );

    await expect(
      service.create({ planDate: '2025-12-13', problemType: 'scenario1' } as any, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
