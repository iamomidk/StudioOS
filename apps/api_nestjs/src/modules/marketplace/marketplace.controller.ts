import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { SearchMarketplaceDto } from './dto/search-marketplace.dto.js';
import { MarketplaceService } from './marketplace.service.js';

@Controller('marketplace')
@UseGuards(AccessTokenGuard)
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('search')
  search(@Query() query: SearchMarketplaceDto, @Req() request: AuthenticatedRequest) {
    return this.marketplaceService.search(query, request.user);
  }
}
