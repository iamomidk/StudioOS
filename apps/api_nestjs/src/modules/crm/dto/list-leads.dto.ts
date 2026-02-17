import { IsString, MinLength } from 'class-validator';

export class ListLeadsDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;
}
