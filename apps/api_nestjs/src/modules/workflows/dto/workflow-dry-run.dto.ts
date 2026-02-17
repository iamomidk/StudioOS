import { IsObject, IsString, MinLength } from 'class-validator';

export class WorkflowDryRunDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsObject()
  triggerInput!: Record<string, unknown>;
}
