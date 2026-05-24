import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { UnitType } from '../../common/enums/unit-type.enum';

export class CreateUnitDto {
  @ApiProperty({ example: 'UDD-MLG-001' })
  @IsString()
  @Matches(/^[A-Z]+-[A-Z]+-\d{3}$/, {
    message: 'Format code must be like UDD-MLG-001',
  })
  code!: string;

  @ApiProperty({ example: 'UDD PMI Kota Malang' })
  @IsString()
  name!: string;

  @ApiProperty({ enum: UnitType, example: UnitType.UDD })
  @IsEnum(UnitType)
  type!: UnitType;

  @ApiProperty({ example: 'Jl. Buring No. 10' })
  @IsString()
  address!: string;

  @ApiProperty({ example: 'Malang' })
  @IsString()
  city!: string;

  @ApiProperty({ example: 'Jawa Timur' })
  @IsString()
  province!: string;

  @ApiProperty({ example: -7.9666, minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: 112.6326, minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ example: '+62341123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'udd.malang@pmi.or.id' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  criticalThreshold?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
