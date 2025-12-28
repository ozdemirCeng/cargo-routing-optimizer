import { IsString, IsEnum, IsOptional, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class PlanParametersDto {
  @ApiProperty({ required: false, example: 1.0 })
  @IsOptional()
  costPerKm?: number;

  @ApiProperty({ required: false, example: 200 })
  @IsOptional()
  rentalCost?: number;

  @ApiProperty({ required: false, example: 500 })
  @IsOptional()
  rentalCapacityKg?: number;
}

export class CreatePlanDto {
  @ApiProperty({ example: '2025-12-13' })
  @IsDateString()
  planDate: string;

  @ApiProperty({
    enum: [
      "unlimited_vehicles",
      "limited_vehicles", // legacy alias (defaults to max_count in optimizer)
      "limited_vehicles_max_count",
      "limited_vehicles_max_weight",
    ],
  })
  @IsEnum([
    "unlimited_vehicles",
    "limited_vehicles",
    "limited_vehicles_max_count",
    "limited_vehicles_max_weight",
  ])
  problemType: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlanParametersDto)
  parameters?: PlanParametersDto;
}
