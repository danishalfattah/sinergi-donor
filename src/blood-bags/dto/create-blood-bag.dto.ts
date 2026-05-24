import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { BloodType } from '../../common/enums/blood-type.enum';
import { ComponentType } from '../../common/enums/component-type.enum';

export class CreateBloodBagDto {
  @ApiProperty({ example: 'BB-2026-00001' })
  @IsString()
  @Matches(/^BB-\d{4}-\d{5}$/, {
    message: 'Format serialNumber must be BB-YYYY-NNNNN',
  })
  serialNumber!: string;

  @ApiProperty({ enum: BloodType, example: BloodType.O_NEG })
  @IsEnum(BloodType)
  bloodType!: BloodType;

  @ApiProperty({ enum: ComponentType, example: ComponentType.PRC })
  @IsEnum(ComponentType)
  component!: ComponentType;

  @ApiProperty({ example: 350, minimum: 200, maximum: 500 })
  @IsInt()
  @Min(200)
  @Max(500)
  volumeMl!: number;

  @ApiProperty({ example: '2026-05-24T08:30:00.000Z' })
  @IsDateString()
  collectionDate!: string;

  @ApiProperty({ example: 'clx123unitid' })
  @IsString()
  unitId!: string;

  @ApiPropertyOptional({ example: 'donor-cuid' })
  @IsOptional()
  @IsString()
  donorId?: string;

  @ApiPropertyOptional({ example: 'Routine donation' })
  @IsOptional()
  @IsString()
  notes?: string;
}
