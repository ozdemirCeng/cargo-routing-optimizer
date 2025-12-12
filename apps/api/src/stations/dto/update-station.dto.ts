import { PartialType } from '@nestjs/swagger';
import { CreateStationDto } from './create-station.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateStationDto extends PartialType(CreateStationDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
