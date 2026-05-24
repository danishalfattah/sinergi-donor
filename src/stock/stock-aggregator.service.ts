import { Injectable, Logger } from '@nestjs/common';
import { BloodType } from '../common/enums/blood-type.enum.js';
import { BloodBagStatus } from '../common/enums/blood-bag-status.enum.js';
import { ComponentType } from '../common/enums/component-type.enum.js';
import { EventPublisherService } from '../common/events/event-publisher.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CriticalStockResponseDto } from './dto/critical-stock-response.dto.js';
import { StockSummaryItemDto } from './dto/stock-summary-response.dto.js';

@Injectable()
export class StockAggregator {
  private readonly logger = new Logger(StockAggregator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async summary(): Promise<StockSummaryItemDto[]> {
    const grouped = await this.prisma.bloodBag.groupBy({
      by: ['unitId', 'bloodType', 'component'],
      where: {
        status: BloodBagStatus.AVAILABLE,
        expiryDate: { gt: new Date() },
        unit: { isActive: true },
      },
      _count: { _all: true },
    });
    const unitIds = [...new Set(grouped.map((item) => item.unitId))];
    const units = await this.prisma.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, code: true, name: true },
    });
    const unitMap = new Map(units.map((unit) => [unit.id, unit]));

    return grouped.map((item) => {
      const unit = unitMap.get(item.unitId);
      return {
        unitId: item.unitId,
        unitCode: unit?.code ?? '',
        unitName: unit?.name ?? '',
        bloodType: item.bloodType as BloodType,
        component: item.component as ComponentType,
        availableCount: item._count._all,
      };
    });
  }

  async critical(): Promise<CriticalStockResponseDto[]> {
    const units = await this.prisma.unit.findMany({
      where: { isActive: true },
      include: {
        bloodBags: {
          where: {
            status: BloodBagStatus.AVAILABLE,
            expiryDate: { gt: new Date() },
          },
          select: { bloodType: true },
        },
      },
    });
    const critical: CriticalStockResponseDto[] = [];

    for (const unit of units) {
      const grouped = new Map<BloodType, number>();
      for (const bag of unit.bloodBags) {
        const bloodType = bag.bloodType as BloodType;
        grouped.set(bloodType, (grouped.get(bloodType) ?? 0) + 1);
      }

      for (const bloodType of Object.values(BloodType)) {
        const availableCount = grouped.get(bloodType) ?? 0;
        if (availableCount < unit.criticalThreshold) {
          critical.push({
            unitId: unit.id,
            unitCode: unit.code,
            unitName: unit.name,
            bloodType,
            availableCount,
            criticalThreshold: unit.criticalThreshold,
            deficit: unit.criticalThreshold - availableCount,
            city: unit.city,
          });

          // Publish stock critical event
          await this.eventPublisher.publishStockCritical(unit.id, bloodType);
        }
      }
    }

    return critical;
  }

  async getByUnit(unitId: string): Promise<StockSummaryItemDto[]> {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, code: true, name: true, isActive: true },
    });

    if (!unit || !unit.isActive) {
      return [];
    }

    const grouped = await this.prisma.bloodBag.groupBy({
      by: ['bloodType', 'component'],
      where: {
        unitId,
        status: BloodBagStatus.AVAILABLE,
        expiryDate: { gt: new Date() },
      },
      _count: { _all: true },
    });

    return grouped.map((item) => ({
      unitId: unit.id,
      unitCode: unit.code,
      unitName: unit.name,
      bloodType: item.bloodType as BloodType,
      component: item.component as ComponentType,
      availableCount: item._count._all,
    }));
  }
}
