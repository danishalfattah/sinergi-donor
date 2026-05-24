import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CancelTransferDto {
  @ApiProperty({ example: 'Destination unit no longer needs the stock' })
  @IsString()
  @MinLength(3)
  cancelReason!: string;
}
