import { Injectable } from '@nestjs/common';
import { BloodBagStatus } from '../common/enums/blood-bag-status.enum.js';
import { haversineDistanceKm } from '../common/utils/geo.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExpiringSoonQueryDto } from './dto/expiring-soon-query.dto.js';

@Injectable()
export class FefoEngine {
  constructor(private readonly prisma: PrismaService) {}

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
