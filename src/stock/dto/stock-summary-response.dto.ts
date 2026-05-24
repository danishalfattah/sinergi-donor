import { ApiProperty } from '@nestjs/swagger';
import { BloodType } from '../../common/enums/blood-type.enum';
import { ComponentType } from '../../common/enums/component-type.enum';

export class StockSummaryItemDto {
  @ApiProperty()
  unitId!: string;

  @ApiProperty()
  unitCode!: string;

  @ApiProperty()
  unitName!: string;

  @ApiProperty({ enum: BloodType })
  bloodType!: BloodType;

  @ApiProperty({ enum: ComponentType })
  component!: ComponentType;

  @ApiProperty()
  availableCount!: number;
}
