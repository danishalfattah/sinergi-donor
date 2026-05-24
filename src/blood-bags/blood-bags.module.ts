import { Module } from '@nestjs/common';
import { BloodBagsController } from './blood-bags.controller';
import { BloodBagsService } from './blood-bags.service';

@Module({
  controllers: [BloodBagsController],
  providers: [BloodBagsService],
  exports: [BloodBagsService],
})
export class BloodBagsModule {}
