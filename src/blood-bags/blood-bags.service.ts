import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PaginatedResult } from '../common/dto/pagination.dto.js';
import { BloodBagStatus } from '../common/enums/blood-bag-status.enum.js';
import { ComponentType } from '../common/enums/component-type.enum.js';
import { EventPublisherService } from '../common/events/event-publisher.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBloodBagDto } from './dto/create-blood-bag.dto.js';
import { FilterBloodBagsDto } from './dto/filter-blood-bags.dto.js';
import { UpdateBloodBagStatusDto } from './dto/update-blood-bag-status.dto.js';

const SHELF_LIFE_DAYS: Record<ComponentType, number> = {
  [ComponentType.WHOLE_BLOOD]: 35,
  [ComponentType.PRC]: 42,
  [ComponentType.TC]: 5,
  [ComponentType.FFP]: 365,
};

const ALLOWED_TRANSITIONS: Record<BloodBagStatus, BloodBagStatus[]> = {
  [BloodBagStatus.AVAILABLE]: [
    BloodBagStatus.RESERVED,
    BloodBagStatus.IN_TRANSIT,
    BloodBagStatus.USED,
    BloodBagStatus.EXPIRED,
    BloodBagStatus.DISCARDED,
  ],
  [BloodBagStatus.RESERVED]: [
    BloodBagStatus.AVAILABLE,
    BloodBagStatus.USED,
    BloodBagStatus.EXPIRED,
    BloodBagStatus.DISCARDED,
  ],
  [BloodBagStatus.IN_TRANSIT]: [BloodBagStatus.AVAILABLE, BloodBagStatus.DISCARDED],
  [BloodBagStatus.USED]: [],
  [BloodBagStatus.EXPIRED]: [BloodBagStatus.DISCARDED],
  [BloodBagStatus.DISCARDED]: [],
};

@Injectable()
export class BloodBagsService {
  private readonly logger = new Logger(BloodBagsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async create(dto: CreateBloodBagDto) {
    await this.assertUnitActive(dto.unitId);
    const existing = await this.prisma.bloodBag.findUnique({
      where: { serialNumber: dto.serialNumber },
    });
    if (existing) {
      throw new ConflictException(`Blood bag ${dto.serialNumber} already exists`);
    }

    const collectionDate = new Date(dto.collectionDate);
    const expiryDate = this.calculateExpiryDate(collectionDate, dto.component);

    const bag = await this.prisma.bloodBag.create({
      data: {
        serialNumber: dto.serialNumber,
        bloodType: dto.bloodType,
        component: dto.component,
        volumeMl: dto.volumeMl,
        collectionDate,
        expiryDate,
        status: BloodBagStatus.AVAILABLE,
        unitId: dto.unitId,
        donorId: dto.donorId,
        notes: dto.notes,
      },
      include: { unit: true },
    });

    // Publish stock updated event after successful creation
    await this.eventPublisher.publishStockUpdated(bag);

    return bag;
  }

  async findAll(query: FilterBloodBagsDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.BloodBagWhereInput = {
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.bloodType ? { bloodType: query.bloodType } : {}),
      ...(query.component ? { component: query.component } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.expiringBefore
        ? { expiryDate: { lte: new Date(query.expiringBefore) } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.bloodBag.findMany({
        where,
        include: { unit: { select: { id: true, code: true, name: true, city: true } } },
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.bloodBag.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const bloodBag = await this.prisma.bloodBag.findUnique({
      where: { id },
      include: { unit: true, transfer: true },
    });
    if (!bloodBag) {
      throw new NotFoundException(`Blood bag ${id} not found`);
    }

    return bloodBag;
  }

  async updateStatus(id: string, dto: UpdateBloodBagStatusDto) {
    const bloodBag = await this.prisma.bloodBag.findUnique({ where: { id } });
    if (!bloodBag) {
      throw new NotFoundException(`Blood bag ${id} not found`);
    }

    const current = bloodBag.status as BloodBagStatus;
    if (!ALLOWED_TRANSITIONS[current].includes(dto.status)) {
      throw new BadRequestException(`Cannot transition from ${current} to ${dto.status}`);
    }

    const updatedBag = await this.prisma.bloodBag.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes ?? bloodBag.notes,
      },
      include: { unit: true },
    });

    // Publish stock updated event after successful status change
    await this.eventPublisher.publishStockUpdated(updatedBag);

    return updatedBag;
  }

  private async assertUnitActive(unitId: string): Promise<void> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit || !unit.isActive) {
      throw new NotFoundException(`Unit ${unitId} not found or inactive`);
    }
  }

  private calculateExpiryDate(collectionDate: Date, component: ComponentType): Date {
    const expiry = new Date(collectionDate);
    expiry.setDate(expiry.getDate() + SHELF_LIFE_DAYS[component]);
    return expiry;
  }
}
