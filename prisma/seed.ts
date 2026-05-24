import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { BloodBagStatus } from '../src/common/enums/blood-bag-status.enum';
import { BloodType } from '../src/common/enums/blood-type.enum';
import { ComponentType } from '../src/common/enums/component-type.enum';
import { TransferReason } from '../src/common/enums/transfer-reason.enum';
import { TransferStatus } from '../src/common/enums/transfer-status.enum';
import { UnitType } from '../src/common/enums/unit-type.enum';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const shelfLifeDays: Record<ComponentType, number> = {
  [ComponentType.WHOLE_BLOOD]: 35,
  [ComponentType.PRC]: 42,
  [ComponentType.TC]: 5,
  [ComponentType.FFP]: 365,
};

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function collectionDateForExpiry(component: ComponentType, daysUntilExpiry: number): Date {
  return daysFromNow(daysUntilExpiry - shelfLifeDays[component]);
}

async function main() {
  await prisma.bloodBag.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.unit.deleteMany();

  const units = await Promise.all([
    prisma.unit.create({
      data: {
        code: 'UDD-MLG-001',
        name: 'UDD PMI Kota Malang',
        type: UnitType.UDD,
        address: 'Jl. Buring No. 10',
        city: 'Malang',
        province: 'Jawa Timur',
        latitude: -7.9666,
        longitude: 112.6326,
        phone: '+62341123456',
        email: 'udd.malang@pmi.or.id',
        criticalThreshold: 1,
      },
    }),
    prisma.unit.create({
      data: {
        code: 'UDD-SBY-001',
        name: 'UDD PMI Kota Surabaya',
        type: UnitType.UDD,
        address: 'Jl. Embong Ploso No. 7',
        city: 'Surabaya',
        province: 'Jawa Timur',
        latitude: -7.2575,
        longitude: 112.7521,
        criticalThreshold: 1,
      },
    }),
    prisma.unit.create({
      data: {
        code: 'UDD-JKT-001',
        name: 'UDD PMI DKI Jakarta',
        type: UnitType.UDD,
        address: 'Jl. Kramat Raya No. 47',
        city: 'Jakarta',
        province: 'DKI Jakarta',
        latitude: -6.1865,
        longitude: 106.8341,
        criticalThreshold: 1,
      },
    }),
    prisma.unit.create({
      data: {
        code: 'BDRS-MLG-001',
        name: 'BDRS RSSA Malang',
        type: UnitType.BDRS,
        address: 'Jl. Jaksa Agung Suprapto No. 2',
        city: 'Malang',
        province: 'Jawa Timur',
        latitude: -7.9721,
        longitude: 112.6304,
        criticalThreshold: 2,
      },
    }),
    prisma.unit.create({
      data: {
        code: 'BDRS-JKT-001',
        name: 'BDRS RSCM Jakarta',
        type: UnitType.BDRS,
        address: 'Jl. Diponegoro No. 71',
        city: 'Jakarta',
        province: 'DKI Jakarta',
        latitude: -6.1969,
        longitude: 106.8466,
        criticalThreshold: 1,
      },
    }),
  ]);

  let serial = 1;
  const components = Object.values(ComponentType);
  const bloodTypes = Object.values(BloodType);
  const createdBagIds: string[] = [];

  for (const unit of units) {
    for (const bloodType of bloodTypes) {
      const component = components[serial % components.length];
      const bag = await prisma.bloodBag.create({
        data: {
          serialNumber: `BB-2026-${String(serial).padStart(5, '0')}`,
          bloodType,
          component,
          volumeMl: 350,
          collectionDate: collectionDateForExpiry(component, 20 + (serial % 12)),
          expiryDate: daysFromNow(20 + (serial % 12)),
          status: BloodBagStatus.AVAILABLE,
          unitId: unit.id,
          notes: 'Seed baseline stock',
        },
      });
      createdBagIds.push(bag.id);
      serial += 1;
    }
  }

  const rssa = units[3];
  for (const bloodType of bloodTypes.filter((type) => type !== BloodType.O_NEG)) {
    const component = components[serial % components.length];
    const bag = await prisma.bloodBag.create({
      data: {
        serialNumber: `BB-2026-${String(serial).padStart(5, '0')}`,
        bloodType,
        component,
        volumeMl: 350,
        collectionDate: collectionDateForExpiry(component, 28),
        expiryDate: daysFromNow(28),
        status: BloodBagStatus.AVAILABLE,
        unitId: rssa.id,
        notes: 'RSSA buffer stock',
      },
    });
    createdBagIds.push(bag.id);
    serial += 1;
  }

  for (let i = 0; i < 3; i += 1) {
    const component = ComponentType.PRC;
    const bag = await prisma.bloodBag.create({
      data: {
        serialNumber: `BB-2026-${String(serial).padStart(5, '0')}`,
        bloodType: [BloodType.A_POS, BloodType.B_POS, BloodType.AB_POS][i],
        component,
        volumeMl: 350,
        collectionDate: collectionDateForExpiry(component, 30 + i),
        expiryDate: daysFromNow(30 + i),
        status: BloodBagStatus.RESERVED,
        unitId: units[i].id,
        notes: 'Reserved seed bag',
      },
    });
    createdBagIds.push(bag.id);
    serial += 1;
  }

  for (let i = 0; i < 5; i += 1) {
    const component = ComponentType.TC;
    await prisma.bloodBag.create({
      data: {
        serialNumber: `BB-2026-${String(serial).padStart(5, '0')}`,
        bloodType: bloodTypes[i],
        component,
        volumeMl: 250,
        collectionDate: collectionDateForExpiry(component, i + 1),
        expiryDate: daysFromNow(i + 1),
        status: BloodBagStatus.AVAILABLE,
        unitId: units[i % units.length].id,
        notes: 'Expiring soon FEFO test bag',
      },
    });
    serial += 1;
  }

  await prisma.stockTransfer.create({
    data: {
      transferCode: 'TRF-2026-00001',
      fromUnitId: units[0].id,
      toUnitId: units[3].id,
      reason: TransferReason.MANUAL,
      status: TransferStatus.COMPLETED,
      notes: 'Completed sample transfer',
      dispatchedAt: daysFromNow(-2),
      completedAt: daysFromNow(-1),
    },
  });

  const pendingBag = await prisma.bloodBag.findFirstOrThrow({
    where: {
      id: { in: createdBagIds },
      unitId: units[1].id,
      status: BloodBagStatus.AVAILABLE,
      expiryDate: { gt: new Date() },
    },
  });
  const pendingTransfer = await prisma.stockTransfer.create({
    data: {
      transferCode: 'TRF-2026-00002',
      fromUnitId: units[1].id,
      toUnitId: units[3].id,
      reason: TransferReason.CRITICAL_REQUEST,
      status: TransferStatus.PENDING,
      notes: 'Pending sample transfer',
    },
  });
  await prisma.bloodBag.update({
    where: { id: pendingBag.id },
    data: {
      status: BloodBagStatus.IN_TRANSIT,
      transferId: pendingTransfer.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
