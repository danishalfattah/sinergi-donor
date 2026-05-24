import { Module } from '@nestjs/common';
import { StockController } from './stock.controller.js';
import { StockAggregator } from './stock-aggregator.service.js';
import { FefoEngine } from './fefo-engine.service.js';

@Module({
  controllers: [StockController],
  providers: [StockAggregator, FefoEngine],
  exports: [StockAggregator, FefoEngine],
})
export class StockModule {}
