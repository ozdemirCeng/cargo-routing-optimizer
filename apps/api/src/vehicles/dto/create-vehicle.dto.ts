import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVehicleDto {
  @ApiProperty({ example: '41 KRG 004' })
  @IsString()
  plateNumber: string;

  @ApiProperty({ example: 'Araç 4 (600 kg)' })
  @IsString()
  name: string;

  @ApiProperty({ example: 600 })
  @IsNumber()
  capacityKg: number;

  @ApiProperty({ required: false, enum: ['owned', 'rented'] })
  @IsOptional()
  @IsEnum(['owned', 'rented'])
  ownership?: string;

  @ApiProperty({ required: false, example: 0 })
  @IsOptional()
  @IsNumber()
  rentalCost?: number;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
