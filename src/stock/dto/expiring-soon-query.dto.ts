import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ExpiringSoonQueryDto {
  @ApiPropertyOptional({ example: 7, default: 7, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days = 7;

  @ApiPropertyOptional({ example: 'clx123unitid' })
  @IsOptional()
  @IsString()
  unitId?: string;
}
