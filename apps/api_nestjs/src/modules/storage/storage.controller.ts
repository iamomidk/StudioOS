import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { PresignDownloadDto, PresignUploadDto } from './dto/presign-upload.dto.js';
import { StorageService } from './storage.service.js';

@Controller('storage')
@UseGuards(AccessTokenGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('presign-upload')
  presignUpload(@Body() dto: PresignUploadDto, @Req() request: AuthenticatedRequest) {
    return this.storageService.presignUpload(dto, request.user);
  }

  @Post('presign-download')
  presignDownload(@Body() dto: PresignDownloadDto, @Req() request: AuthenticatedRequest) {
    return this.storageService.presignDownload(dto, request.user);
  }
}
