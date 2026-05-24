import { ApiProperty } from '@nestjs/swagger';
import { BloodType } from '../../common/enums/blood-type.enum';

export class CriticalStockResponseDto {
  @ApiProperty()
  unitId!: string;

  @ApiProperty()
  unitCode!: string;

  @ApiProperty()
  unitName!: string;

  @ApiProperty({ enum: BloodType })
  bloodType!: BloodType;

  @ApiProperty()
  availableCount!: number;

  @ApiProperty()
  criticalThreshold!: number;

  @ApiProperty()
  deficit!: number;

  @ApiProperty()
  city!: string;
}
