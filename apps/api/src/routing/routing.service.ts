import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';

type OsrmRouteResponse = {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: string;
  }>;
};

@Injectable()
export class RoutingService {
  private osrmUrl: string;
  private allowHaversineFallback: boolean;

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.osrmUrl = this.configService.get<string>('OSRM_URL') || 'http://localhost:5001';
    this.allowHaversineFallback = Boolean(this.configService.get('ALLOW_HAVERSINE_FALLBACK'));
  }

  // İki istasyon arası mesafe ve polyline
  async getDistance(fromStationId: string, toStationId: string) {
    // Önce cache'e bak
    const cached = await this.prisma.distanceMatrix.findUnique({
      where: {
        fromStationId_toStationId: { fromStationId, toStationId },
      },
    });

    if (cached) {
      return {
        distance_km: Number(cached.distanceKm),
        duration_minutes: Number(cached.durationMinutes),
        polyline: cached.polyline,
      };
    }

    // İstasyonları al
    const [fromStation, toStation] = await Promise.all([
      this.prisma.station.findUnique({ where: { id: fromStationId } }),
      this.prisma.station.findUnique({ where: { id: toStationId } }),
    ]);

    if (!fromStation || !toStation) {
      throw new Error('Station not found');
    }

    // OSRM'den hesapla
    const result = await this.calculateRoute(
      Number(fromStation.longitude),
      Number(fromStation.latitude),
      Number(toStation.longitude),
      Number(toStation.latitude),
    );

    // Cache'e kaydet
    await this.prisma.distanceMatrix.create({
      data: {
        fromStationId,
        toStationId,
        distanceKm: result.distance_km,
        durationMinutes: result.duration_minutes,
        polyline: result.polyline,
      },
    });

    return result;
  }

  // OSRM ile rota hesapla
  async calculateRoute(
    fromLon: number,
    fromLat: number,
    toLon: number,
    toLat: number,
  ): Promise<{ distance_km: number; duration_minutes: number; polyline: string }> {
    try {
      const url = `${this.osrmUrl}/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=polyline`;
      const response = await firstValueFrom(this.httpService.get<OsrmRouteResponse>(url));
      const data = response.data;

      if (data.code !== 'Ok' || !data.routes?.length) {
        throw new Error('OSRM routing failed');
      }

      const route = data.routes[0];
      return {
        distance_km: route.distance / 1000,
        duration_minutes: route.duration / 60,
        polyline: route.geometry,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('OSRM error:', message);

      if (!this.allowHaversineFallback) {
        throw new ServiceUnavailableException(
          'OSRM servisinden rota hesaplanamadı. Lütfen OSRM_URL ayarını ve OSRM servisinin çalıştığını kontrol edin.',
        );
      }

      // Fallback (debug only): Haversine mesafesi
      const distance = this.haversineDistance(fromLat, fromLon, toLat, toLon);
      return {
        distance_km: distance * 1.3,
        duration_minutes: ((distance * 1.3) / 50) * 60,
        polyline: '',
      };
    }
  }

  // NxN mesafe matrisi (optimizer için)
  async getDistanceMatrix(stationIds: string[]): Promise<Record<string, any>> {
    const matrix: Record<string, any> = {};

    // İstasyon bilgilerini al
    const stations = await this.prisma.station.findMany({
      where: { id: { in: stationIds } },
    });

    const stationMap = new Map(stations.map(s => [s.id, s]));

    // Her çift için mesafe hesapla
    for (const fromId of stationIds) {
      for (const toId of stationIds) {
        if (fromId === toId) continue;

        const key = `${fromId}_${toId}`;
        
        try {
          const distance = await this.getDistance(fromId, toId);
          matrix[key] = distance;
        } catch (error) {
          console.error(`Distance calculation failed for ${key}:`, error.message);
        }
      }
    }

    return matrix;
  }

  // Cache'i yenile
  async refreshCache() {
    // Tüm aktif istasyonları al
    const stations = await this.prisma.station.findMany({
      where: { isActive: true },
    });

    // Mevcut cache'i temizle
    await this.prisma.distanceMatrix.deleteMany({});

    // Yeniden hesapla
    const stationIds = stations.map(s => s.id);
    await this.getDistanceMatrix(stationIds);

    return { message: 'Cache refreshed', stationCount: stations.length };
  }

  // Haversine mesafe formülü
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
