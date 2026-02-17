import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetData(): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.rentalOrder.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.project.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.quoteLineItem.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.client.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}

async function main(): Promise<void> {
  await resetData();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const organization = await prisma.organization.create({
    data: {
      name: 'StudioOS Demo Org'
    }
  });

  const owner = await prisma.user.create({
    data: {
      email: 'owner@studioos.dev',
      firstName: 'Omid',
      lastName: 'Owner',
      passwordHash
    }
  });

  await prisma.membership.create({
    data: {
      organizationId: organization.id,
      userId: owner.id,
      role: 'owner'
    }
  });

  const client = await prisma.client.create({
    data: {
      organizationId: organization.id,
      name: 'Acme Studios',
      email: 'contact@acme.studio'
    }
  });

  await prisma.lead.create({
    data: {
      organizationId: organization.id,
      name: 'Acme Lead',
      email: 'lead@acme.studio',
      status: 'qualified'
    }
  });

  const booking = await prisma.booking.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      title: 'Commercial Shoot',
      startsAt: new Date('2026-03-10T09:00:00.000Z'),
      endsAt: new Date('2026-03-10T17:00:00.000Z'),
      status: 'confirmed'
    }
  });

  await prisma.project.create({
    data: {
      organizationId: organization.id,
      bookingId: booking.id,
      clientId: client.id,
      ownerUserId: owner.id,
      name: 'Commercial Edit',
      status: 'edit'
    }
  });

  const asset = await prisma.asset.create({
    data: {
      organizationId: organization.id,
      name: 'Sony A7S III',
      category: 'camera'
    }
  });

  const inventoryItem = await prisma.inventoryItem.create({
    data: {
      organizationId: organization.id,
      assetId: asset.id,
      serialNumber: 'SN-DEMO-001',
      condition: 'excellent'
    }
  });

  await prisma.rentalOrder.create({
    data: {
      organizationId: organization.id,
      inventoryItemId: inventoryItem.id,
      clientId: client.id,
      assignedUserId: owner.id,
      startsAt: new Date('2026-03-12T08:00:00.000Z'),
      endsAt: new Date('2026-03-13T20:00:00.000Z'),
      status: 'reserved'
    }
  });

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      invoiceNumber: 'INV-0001',
      status: 'issued',
      subtotalCents: 200000,
      taxCents: 20000,
      totalCents: 220000,
      issuedAt: new Date('2026-03-11T10:00:00.000Z'),
      dueAt: new Date('2026-03-18T10:00:00.000Z')
    }
  });

  await prisma.payment.create({
    data: {
      organizationId: organization.id,
      invoiceId: invoice.id,
      userId: owner.id,
      provider: 'manual',
      providerRef: 'PAY-DEMO-001',
      amountCents: 220000,
      status: 'succeeded',
      paidAt: new Date('2026-03-12T12:00:00.000Z')
    }
  });

  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      actorUserId: owner.id,
      entityType: 'Invoice',
      entityId: invoice.id,
      action: 'created',
      metadata: {
        invoiceNumber: 'INV-0001'
      }
    }
  });

  console.log(`Seed complete for org ${organization.id}`);
}

void main()
  .catch((error: unknown) => {
    console.error('Seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
