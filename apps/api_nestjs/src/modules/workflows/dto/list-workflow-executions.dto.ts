import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class ListWorkflowExecutionsDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
