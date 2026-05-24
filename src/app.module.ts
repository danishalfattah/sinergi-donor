import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BloodBagsModule } from './blood-bags/blood-bags.module';
import { PrismaModule } from './prisma/prisma.module';
import { StockTransfersModule } from './stock-transfers/stock-transfers.module';
import { StockModule } from './stock/stock.module';
import { UnitsModule } from './units/units.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UnitsModule,
    BloodBagsModule,
    StockModule,
    StockTransfersModule,
  ],
})
export class AppModule {}
