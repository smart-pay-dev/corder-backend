import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  showInTerminal?: boolean;

  @IsOptional()
  @IsBoolean()
  showInMenu?: boolean;

  @IsOptional()
  order?: number;
}
