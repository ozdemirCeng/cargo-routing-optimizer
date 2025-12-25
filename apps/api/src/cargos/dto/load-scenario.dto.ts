import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsOptional,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";

export class ScenarioCargoItemDto {
  @ApiProperty({
    description: "İstasyon kodu (BSK, CYR, etc.)",
    example: "BSK",
  })
  @IsString()
  stationCode: string;

  @ApiProperty({ description: "Kargo sayısı", example: 10 })
  @IsNumber()
  @Min(1)
  count: number;

  @ApiProperty({ description: "Toplam ağırlık (kg)", example: 120 })
  @IsNumber()
  @Min(0.1)
  weight: number;
}

export class LoadScenarioDto {
  @ApiProperty({ description: "Senaryo ID", example: "scenario1" })
  @IsString()
  scenarioId: string;

  @ApiProperty({ description: "Senaryo adı", example: "Senaryo 1" })
  @IsString()
  scenarioName: string;

  @ApiProperty({ description: "Planlanan tarih", example: "2025-12-26" })
  @IsDateString()
  scheduledDate: string;

  @ApiProperty({
    description: "Senaryo kargo verileri",
    type: [ScenarioCargoItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScenarioCargoItemDto)
  data: ScenarioCargoItemDto[];

  @ApiProperty({
    description: "Mevcut kargoları temizle",
    example: true,
    required: false,
  })
  @IsOptional()
  clearExisting?: boolean;
}
