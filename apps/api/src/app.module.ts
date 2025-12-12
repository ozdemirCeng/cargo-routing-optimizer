import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
  ],
})
export class AppModule {}
