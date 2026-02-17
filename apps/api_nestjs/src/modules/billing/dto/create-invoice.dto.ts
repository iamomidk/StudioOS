import { IsISO8601, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  clientId!: string;

  @IsString()
  @MinLength(1)
  invoiceNumber!: string;

  @IsInt()
  @Min(0)
  @Max(1000000000)
  subtotalCents!: number;

  @IsInt()
  @Min(0)
  @Max(1000000000)
  taxCents!: number;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}
