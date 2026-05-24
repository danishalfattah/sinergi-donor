import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BloodBagsModule } from './blood-bags/blood-bags.module.js';
import { EventPublisherModule } from './common/events/event-publisher.module.js';
import { LegacyAdapterModule } from './legacy/legacy-adapter.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StockTransfersModule } from './stock-transfers/stock-transfers.module.js';
import { StockModule } from './stock/stock.module.js';
import { UnitsModule } from './units/units.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EventPublisherModule,
    LegacyAdapterModule,
    UnitsModule,
    BloodBagsModule,
    StockModule,
    StockTransfersModule,
  ],
})
export class AppModule {}
