import { IsString, MinLength } from 'class-validator';

export class ListQuotesDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;
}
