import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BloodBagStatus } from '../../common/enums/blood-bag-status.enum';

export class UpdateBloodBagStatusDto {
  @ApiProperty({ enum: BloodBagStatus, example: BloodBagStatus.RESERVED })
  @IsEnum(BloodBagStatus)
  status!: BloodBagStatus;

  @ApiPropertyOptional({ example: 'Reserved for cito request' })
  @IsOptional()
  @IsString()
  notes?: string;
}
