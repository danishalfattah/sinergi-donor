import { Injectable } from '@nestjs/common';
import { BloodType } from '../common/enums/blood-type.enum';
import { BloodBagStatus } from '../common/enums/blood-bag-status.enum';
import { ComponentType } from '../common/enums/component-type.enum';
import { haversineDistanceKm } from '../common/utils/geo.util';
import { PrismaService } from '../prisma/prisma.service';
import { CriticalStockResponseDto } from './dto/critical-stock-response.dto';
import { ExpiringSoonQueryDto } from './dto/expiring-soon-query.dto';
import { StockSummaryItemDto } from './dto/stock-summary-response.dto';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

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
        }
      }
    }

    return critical;
  }

  async expiringSoon(query: ExpiringSoonQueryDto) {
    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + (query.days ?? 7));
    const bags = await this.prisma.bloodBag.findMany({
      where: {
        status: BloodBagStatus.AVAILABLE,
        expiryDate: { gt: now, lte: until },
        ...(query.unitId ? { unitId: query.unitId } : {}),
        unit: { isActive: true },
      },
      include: {
        unit: true,
      },
      orderBy: { expiryDate: 'asc' },
    });
    const activeUnits = await this.prisma.unit.findMany({
      where: { isActive: true },
    });

    return bags.map((bag) => {
      const suggestions = activeUnits
        .filter((unit) => unit.id !== bag.unitId)
        .map((unit) => ({
          unitId: unit.id,
          unitCode: unit.code,
          unitName: unit.name,
          distanceKm: Number(
            haversineDistanceKm(
              Number(bag.unit.latitude),
              Number(bag.unit.longitude),
              Number(unit.latitude),
              Number(unit.longitude),
            ).toFixed(2),
          ),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 3);

      return {
        ...bag,
        daysUntilExpiry: Math.ceil(
          (bag.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
        suggestedTargetUnits: suggestions,
      };
    });
  }
}
