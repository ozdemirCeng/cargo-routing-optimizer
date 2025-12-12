import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { StationsModule } from '../stations/stations.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { RoutingModule } from '../routing/routing.module';
import { ParametersModule } from '../parameters/parameters.module';

@Module({
  imports: [HttpModule, StationsModule, VehiclesModule, RoutingModule, ParametersModule],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
