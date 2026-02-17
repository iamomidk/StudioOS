import { IsString, MinLength } from 'class-validator';

export class WorkflowControlDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;
}
