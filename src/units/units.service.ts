import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { FilterUnitsDto } from './dto/filter-units.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUnitDto) {
    const existing = await this.prisma.unit.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Unit code ${dto.code} already exists`);
    }

    return this.prisma.unit.create({
      data: {
        ...dto,
        criticalThreshold: dto.criticalThreshold ?? 5,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(query: FilterUnitsDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.UnitWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.city
        ? { city: { contains: query.city, mode: Prisma.QueryMode.insensitive } }
        : {}),
      ...(query.province
        ? { province: { contains: query.province, mode: Prisma.QueryMode.insensitive } }
        : {}),
      isActive: query.isActive ?? true,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.unit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.unit.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            bloodBags: true,
            transfersFrom: true,
            transfersTo: true,
          },
        },
      },
    });
    if (!unit) {
      throw new NotFoundException(`Unit ${id} not found`);
    }

    return unit;
  }

  async update(id: string, dto: UpdateUnitDto) {
    await this.assertExists(id);

    return this.prisma.unit.update({
      where: { id },
      data: dto,
    });
  }

  async deactivate(id: string) {
    await this.assertExists(id);

    return {
      data: await this.prisma.unit.update({
        where: { id },
        data: { isActive: false },
      }),
      message: 'Unit deactivated',
    };
  }

  private async assertExists(id: string): Promise<void> {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) {
      throw new NotFoundException(`Unit ${id} not found`);
    }
  }
}
