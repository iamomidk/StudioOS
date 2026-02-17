import { IsString, MinLength } from 'class-validator';

export class ListBookingsDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;
}
