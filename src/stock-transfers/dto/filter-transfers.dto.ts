import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { TransferReason } from '../../common/enums/transfer-reason.enum';
import { TransferStatus } from '../../common/enums/transfer-status.enum';

export class FilterTransfersDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'clxsourceunit' })
  @IsOptional()
  @IsString()
  fromUnitId?: string;

  @ApiPropertyOptional({ example: 'clxtargetunit' })
  @IsOptional()
  @IsString()
  toUnitId?: string;

  @ApiPropertyOptional({ enum: TransferStatus })
  @IsOptional()
  @IsEnum(TransferStatus)
  status?: TransferStatus;

  @ApiPropertyOptional({ enum: TransferReason })
  @IsOptional()
  @IsEnum(TransferReason)
  reason?: TransferReason;
}
