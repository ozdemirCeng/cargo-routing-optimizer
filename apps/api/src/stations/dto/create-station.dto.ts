import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStationDto {
  @ApiProperty({ example: 'Yeni İlçe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'YENIILCE' })
  @IsString()
  code: string;

  @ApiProperty({ example: 40.75 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: 29.9 })
  @IsNumber()
  longitude: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isHub?: boolean;
}
