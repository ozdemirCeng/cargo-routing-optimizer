import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StationsModule } from './stations/stations.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { CargosModule } from './cargos/cargos.module';
import { PlansModule } from './plans/plans.module';
import { TripsModule } from './trips/trips.module';
import { RoutingModule } from './routing/routing.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ParametersModule } from './parameters/parameters.module';
import { HealthModule } from './health/health.module';
import { ScenariosModule } from './scenarios/scenarios.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('THROTTLE_TTL_SECONDS') || 60,
          limit: configService.get<number>('THROTTLE_LIMIT') || 120,
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    StationsModule,
    VehiclesModule,
    CargosModule,
    PlansModule,
    TripsModule,
    RoutingModule,
    DashboardModule,
    ParametersModule,
    HealthModule,
    ScenariosModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
