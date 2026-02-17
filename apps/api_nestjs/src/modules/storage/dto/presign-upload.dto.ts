import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class PresignUploadDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  objectKey!: string;

  @IsString()
  @MinLength(1)
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(1073741824)
  contentLengthBytes!: number;
}

export class PresignDownloadDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  objectKey!: string;
}
