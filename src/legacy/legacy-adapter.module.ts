import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LegacyAdapterService } from './legacy-adapter.service.js';

@Module({
  imports: [HttpModule],
  providers: [LegacyAdapterService],
  exports: [LegacyAdapterService],
})
export class LegacyAdapterModule {}
