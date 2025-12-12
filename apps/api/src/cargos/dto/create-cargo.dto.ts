import { IsString, IsNumber, IsOptional, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCargoDto {
  @ApiProperty({ description: 'Origin station ID (ilçe)' })
  @IsUUID()
  originStationId: string;

  @ApiProperty({ example: 12.5 })
  @IsNumber()
  weightKg: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, example: '2025-12-13' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;
}
