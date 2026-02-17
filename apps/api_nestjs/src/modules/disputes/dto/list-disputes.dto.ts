import { IsString, MinLength } from 'class-validator';

export class ListDisputesDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;
}
