import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, Min } from 'class-validator';

export class ApplyScenarioDto {
  @IsInt()
  @Min(1)
  scenarioId!: number;

  // Use YYYY-MM-DD or full ISO; will be treated as local date (start of day)
  @IsISO8601()
  date!: string;

  // If true, removes pending cargos for that date before inserting scenario cargos
  @IsOptional()
  @IsBoolean()
  replace?: boolean;

  // Number of demo users to spread cargos across (admin-only test data)
  @IsOptional()
  @IsInt()
  @Min(1)
  demoUsers?: number;

  // Optional: which password to use for created demo users
  @IsOptional()
  @IsIn(['123456'])
  demoPassword?: '123456';
}
