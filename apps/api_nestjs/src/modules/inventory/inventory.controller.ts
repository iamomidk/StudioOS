import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js';
import { ListAssetsDto } from './dto/list-assets.dto.js';
import { ListInventoryItemsDto } from './dto/list-inventory-items.dto.js';
import { InventoryService } from './inventory.service.js';

@Controller('inventory')
@UseGuards(AccessTokenGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('assets')
  listAssets(@Query() query: ListAssetsDto) {
    return this.inventoryService.listAssets(query);
  }

  @Post('assets')
  createAsset(@Body() dto: CreateAssetDto, @Req() request: AuthenticatedRequest) {
    return this.inventoryService.createAsset(dto, request.user);
  }

  @Get('items')
  listItems(@Query() query: ListInventoryItemsDto) {
    return this.inventoryService.listItems(query);
  }

  @Post('items')
  createItem(@Body() dto: CreateInventoryItemDto, @Req() request: AuthenticatedRequest) {
    return this.inventoryService.createItem(dto, request.user);
  }
}
