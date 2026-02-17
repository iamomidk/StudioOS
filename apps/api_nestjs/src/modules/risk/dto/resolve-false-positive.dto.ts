import { IsString, MinLength } from 'class-validator';

export class ResolveFalsePositiveDto {
  @IsString()
  @MinLength(1)
  note!: string;
}
