import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

class SupportAttachmentDto {
  @IsString()
  url!: string;

  @IsString()
  contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class CreateSupportTicketDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(5000)
  description!: string;

  @IsIn(['p0', 'p1', 'p2', 'p3'])
  severity!: 'p0' | 'p1' | 'p2' | 'p3';

  @IsString()
  organizationId!: string;

  @IsOptional()
  @IsString()
  routePath?: string;

  @IsOptional()
  @IsString()
  screenName?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  @IsIn(['web', 'mobile', 'api'])
  source?: 'web' | 'mobile' | 'api';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => SupportAttachmentDto)
  attachments?: SupportAttachmentDto[];
}
