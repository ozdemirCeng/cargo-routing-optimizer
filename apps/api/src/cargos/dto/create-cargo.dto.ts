import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCargoDto {
  @ApiProperty({ description: 'Origin station ID (ilçe)' })
  @IsUUID()
  originStationId: string;

  @ApiProperty({ required: false, example: 1, description: 'Kaç adet kargo oluşturulacağı (toplam ağırlık otomatik bölünür)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  cargoCount?: number;

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
