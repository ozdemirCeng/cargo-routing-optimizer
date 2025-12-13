import { ServiceUnavailableException } from '@nestjs/common';
import { RoutingService } from './routing.service';

describe('RoutingService', () => {
  it('fails fast when stationIds include missing stations', async () => {
    const prisma: any = {
      station: {
        findMany: jest.fn().mockResolvedValue([{ id: 'a' }]),
      },
    };

    const httpService: any = {};
    const configService: any = {
      get: jest.fn((key: string) => {
        if (key === 'OSRM_URL') return 'http://osrm';
        if (key === 'OSRM_TIMEOUT_MS') return 1000;
        if (key === 'ALLOW_HAVERSINE_FALLBACK') return false;
        return undefined;
      }),
    };

    const service = new RoutingService(prisma, httpService, configService);

    await expect(service.getDistanceMatrix(['a', 'b'])).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
