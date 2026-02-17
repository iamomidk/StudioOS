import { BadRequestException, Injectable } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { AppConfigService } from '../../config/app-config.service.js';
import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PresignDownloadDto, PresignUploadDto } from './dto/presign-upload.dto.js';

@Injectable()
export class StorageService {
  private s3Client?: S3Client;

  constructor(private readonly config: AppConfigService) {}

  async presignUpload(dto: PresignUploadDto, actor?: AccessClaims) {
    this.assertObjectKeyValid(dto.objectKey);
    this.assertContentTypeAllowed(dto.contentType);
    if (dto.contentLengthBytes > this.config.s3MaxUploadBytes) {
      throw new BadRequestException(
        `Upload exceeds max allowed size of ${this.config.s3MaxUploadBytes} bytes`
      );
    }

    const key = this.objectKey(dto.organizationId, dto.objectKey);
    const command = new PutObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: key,
      ContentType: dto.contentType,
      Metadata: {
        actorUserId: actor?.sub ?? 'unknown'
      }
    });

    const signedUrl = await getSignedUrl(this.getS3Client(), command, {
      expiresIn: this.config.s3PresignTtlSeconds
    });

    return {
      method: 'PUT',
      url: signedUrl,
      key,
      expiresInSeconds: this.config.s3PresignTtlSeconds,
      requiredHeaders: {
        'Content-Type': dto.contentType
      }
    };
  }

  async presignDownload(dto: PresignDownloadDto, actor?: AccessClaims) {
    this.assertObjectKeyValid(dto.objectKey);

    const key = this.objectKey(dto.organizationId, dto.objectKey);
    const command = new GetObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: key,
      ResponseContentDisposition: `inline; filename="${key.split('/').pop() ?? 'download'}"`,
      ResponseCacheControl: 'private, max-age=60'
    });
    const signedUrl = await getSignedUrl(this.getS3Client(), command, {
      expiresIn: this.config.s3PresignTtlSeconds
    });

    return {
      method: 'GET',
      url: signedUrl,
      key,
      expiresInSeconds: this.config.s3PresignTtlSeconds,
      requestedBy: actor?.sub ?? null
    };
  }

  private objectKey(organizationId: string, objectKey: string): string {
    return `${organizationId}/${objectKey.replace(/^\/+/, '')}`;
  }

  private assertObjectKeyValid(objectKey: string): void {
    if (objectKey.includes('..')) {
      throw new BadRequestException('Invalid object key');
    }
  }

  private assertContentTypeAllowed(contentType: string): void {
    if (!this.config.s3AllowedContentTypes.includes(contentType)) {
      throw new BadRequestException('Unsupported content type');
    }
  }

  private getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: this.config.awsRegion
      });
    }
    return this.s3Client;
  }
}
