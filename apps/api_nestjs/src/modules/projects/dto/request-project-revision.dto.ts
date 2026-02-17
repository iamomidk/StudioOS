import { IsString, MinLength } from 'class-validator';

export class RequestProjectRevisionDto {
  @IsString()
  @MinLength(1)
  comment!: string;
}
