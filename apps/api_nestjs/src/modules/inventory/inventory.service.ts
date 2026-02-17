import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js';
import { ListAssetsDto } from './dto/list-assets.dto.js';
import { ListInventoryItemsDto } from './dto/list-inventory-items.dto.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listAssets(query: ListAssetsDto) {
    return this.prisma.asset.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.category ? { category: query.category } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { category: { contains: query.search, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createAsset(dto: CreateAssetDto, actor?: AccessClaims) {
    const asset = await this.prisma.asset.create({
      data: {
        organizationId: dto.organizationId,
        name: dto.name,
        category: dto.category
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'Asset',
        entityId: asset.id,
        action: 'asset.created',
        metadata: {
          name: asset.name,
          category: asset.category
        }
      }
    });

    return asset;
  }

  async listItems(query: ListInventoryItemsDto) {
    return this.prisma.inventoryItem.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.assetId ? { assetId: query.assetId } : {}),
        ...(query.condition ? { condition: query.condition } : {}),
        ...(query.search
          ? {
              OR: [
                { serialNumber: { contains: query.search, mode: 'insensitive' } },
                { ownerName: { contains: query.search, mode: 'insensitive' } },
                { asset: { name: { contains: query.search, mode: 'insensitive' } } }
              ]
            }
          : {})
      },
      include: { asset: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createItem(dto: CreateInventoryItemDto, actor?: AccessClaims) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: dto.assetId,
        organizationId: dto.organizationId
      },
      select: { id: true }
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    try {
      const item = await this.prisma.inventoryItem.create({
        data: {
          organizationId: dto.organizationId,
          assetId: dto.assetId,
          serialNumber: dto.serialNumber,
          condition: dto.condition,
          ownerName: dto.ownerName ?? null
        },
        include: { asset: true }
      });

      await this.prisma.auditLog.create({
        data: {
          organizationId: dto.organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'InventoryItem',
          entityId: item.id,
          action: 'inventory.item.created',
          metadata: {
            serialNumber: item.serialNumber,
            condition: item.condition
          }
        }
      });

      return item;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        Array.isArray(error.meta?.target) &&
        error.meta.target.includes('organizationId') &&
        error.meta.target.includes('serialNumber')
      ) {
        throw new ConflictException('Duplicate serial number for organization');
      }
      throw error;
    }
  }
}
