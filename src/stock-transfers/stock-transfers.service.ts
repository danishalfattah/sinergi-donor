import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { BloodBagStatus } from '../common/enums/blood-bag-status.enum';
import { TransferStatus } from '../common/enums/transfer-status.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CancelTransferDto } from './dto/cancel-transfer.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { FilterTransfersDto } from './dto/filter-transfers.dto';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class StockTransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTransferDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.fromUnitId === dto.toUnitId) {
        throw new BadRequestException('Source and destination units must be different');
      }

      const [fromUnit, toUnit] = await Promise.all([
        tx.unit.findUnique({ where: { id: dto.fromUnitId } }),
        tx.unit.findUnique({ where: { id: dto.toUnitId } }),
      ]);
      if (!fromUnit || !fromUnit.isActive) {
        throw new NotFoundException(`Source unit ${dto.fromUnitId} not found or inactive`);
      }
      if (!toUnit || !toUnit.isActive) {
        throw new NotFoundException(`Destination unit ${dto.toUnitId} not found or inactive`);
      }

      const uniqueBagIds = [...new Set(dto.bloodBagIds)];
      if (uniqueBagIds.length !== dto.bloodBagIds.length) {
        throw new BadRequestException('bloodBagIds must not contain duplicates');
      }

      const bags = await tx.bloodBag.findMany({
        where: { id: { in: uniqueBagIds } },
      });
      if (bags.length !== uniqueBagIds.length) {
        throw new NotFoundException('Some blood bags were not found');
      }

      const now = new Date();
      for (const bag of bags) {
        if (bag.unitId !== dto.fromUnitId) {
          throw new BadRequestException(
            `Bag ${bag.serialNumber} is not in source unit`,
          );
        }
        if (bag.status !== BloodBagStatus.AVAILABLE) {
          throw new BadRequestException(
            `Bag ${bag.serialNumber} is ${bag.status}, must be AVAILABLE`,
          );
        }
        if (bag.expiryDate <= now) {
          throw new BadRequestException(`Bag ${bag.serialNumber} is already expired`);
        }
      }

      const transfer = await tx.stockTransfer.create({
        data: {
          transferCode: await this.generateTransferCode(tx),
          fromUnitId: dto.fromUnitId,
          toUnitId: dto.toUnitId,
          reason: dto.reason,
          status: TransferStatus.PENDING,
          notes: dto.notes,
          initiatedBy: dto.initiatedBy,
        },
      });

      await tx.bloodBag.updateMany({
        where: { id: { in: uniqueBagIds } },
        data: { transferId: transfer.id, status: BloodBagStatus.IN_TRANSIT },
      });

      return tx.stockTransfer.findUnique({
        where: { id: transfer.id },
        include: this.transferInclude(),
      });
    });
  }

  async findAll(query: FilterTransfersDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.StockTransferWhereInput = {
      ...(query.fromUnitId ? { fromUnitId: query.fromUnitId } : {}),
      ...(query.toUnitId ? { toUnitId: query.toUnitId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.reason ? { reason: query.reason } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockTransfer.findMany({
        where,
        include: this.transferInclude(),
        orderBy: { initiatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: this.transferInclude(),
    });
    if (!transfer) {
      throw new NotFoundException(`Transfer ${id} not found`);
    }

    return transfer;
  }

  async dispatch(id: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({ where: { id } });
    if (!transfer) {
      throw new NotFoundException(`Transfer ${id} not found`);
    }
    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException(`Cannot dispatch ${transfer.status} transfer`);
    }

    return this.prisma.stockTransfer.update({
      where: { id },
      data: { status: TransferStatus.IN_TRANSIT, dispatchedAt: new Date() },
      include: this.transferInclude(),
    });
  }

  async complete(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
        include: { bloodBags: true },
      });
      if (!transfer) {
        throw new NotFoundException(`Transfer ${id} not found`);
      }
      if (
        transfer.status !== TransferStatus.PENDING &&
        transfer.status !== TransferStatus.IN_TRANSIT
      ) {
        throw new BadRequestException(`Cannot complete ${transfer.status} transfer`);
      }

      await tx.stockTransfer.update({
        where: { id },
        data: { status: TransferStatus.COMPLETED, completedAt: new Date() },
      });
      await tx.bloodBag.updateMany({
        where: { transferId: id },
        data: {
          unitId: transfer.toUnitId,
          status: BloodBagStatus.AVAILABLE,
          transferId: null,
        },
      });

      return tx.stockTransfer.findUnique({
        where: { id },
        include: this.transferInclude(),
      });
    });
  }

  async cancel(id: string, dto: CancelTransferDto) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({ where: { id } });
      if (!transfer) {
        throw new NotFoundException(`Transfer ${id} not found`);
      }
      if (transfer.status !== TransferStatus.PENDING) {
        throw new BadRequestException(`Cannot cancel ${transfer.status} transfer`);
      }

      await tx.stockTransfer.update({
        where: { id },
        data: {
          status: TransferStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: dto.cancelReason,
        },
      });
      await tx.bloodBag.updateMany({
        where: { transferId: id },
        data: { status: BloodBagStatus.AVAILABLE, transferId: null },
      });

      return tx.stockTransfer.findUnique({
        where: { id },
        include: this.transferInclude(),
      });
    });
  }

  private async generateTransferCode(tx: TxClient): Promise<string> {
    const year = new Date().getFullYear();
    const count = await tx.stockTransfer.count({
      where: {
        transferCode: {
          startsWith: `TRF-${year}-`,
        },
      },
    });

    return `TRF-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private transferInclude() {
    return {
      fromUnit: { select: { id: true, code: true, name: true, city: true } },
      toUnit: { select: { id: true, code: true, name: true, city: true } },
      bloodBags: true,
    };
  }
}
