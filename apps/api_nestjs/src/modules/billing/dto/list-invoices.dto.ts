import { IsString, MinLength } from 'class-validator';

export class ListInvoicesDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;
}
