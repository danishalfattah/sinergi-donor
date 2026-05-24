import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { BloodBagStatus } from '../../common/enums/blood-bag-status.enum';
import { BloodType } from '../../common/enums/blood-type.enum';
import { ComponentType } from '../../common/enums/component-type.enum';

export class FilterBloodBagsDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'clx123unitid' })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional({ enum: BloodType })
  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;

  @ApiPropertyOptional({ enum: ComponentType })
  @IsOptional()
  @IsEnum(ComponentType)
  component?: ComponentType;

  @ApiPropertyOptional({ enum: BloodBagStatus })
  @IsOptional()
  @IsEnum(BloodBagStatus)
  status?: BloodBagStatus;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiringBefore?: string;
}
