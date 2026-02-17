import { IsInt, Max, Min } from 'class-validator';

export class UpdateInvoiceTotalsDto {
  @IsInt()
  @Min(0)
  @Max(1000000000)
  subtotalCents!: number;

  @IsInt()
  @Min(0)
  @Max(1000000000)
  taxCents!: number;
}
