import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { TransferReason } from '../../common/enums/transfer-reason.enum';

export class CreateTransferDto {
  @ApiProperty({ example: 'clxsourceunit' })
  @IsString()
  fromUnitId!: string;

  @ApiProperty({ example: 'clxtargetunit' })
  @IsString()
  toUnitId!: string;

  @ApiProperty({ enum: TransferReason, example: TransferReason.CRITICAL_REQUEST })
  @IsEnum(TransferReason)
  reason!: TransferReason;

  @ApiProperty({ example: ['clxbloodbag1', 'clxbloodbag2'], type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  bloodBagIds!: string[];

  @ApiPropertyOptional({ example: 'Transfer for critical O_NEG stock' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'staff-user-id' })
  @IsOptional()
  @IsString()
  initiatedBy?: string;
}
