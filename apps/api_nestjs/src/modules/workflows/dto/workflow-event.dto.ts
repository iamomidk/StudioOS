import { IsObject, IsString, MinLength } from 'class-validator';

export class WorkflowEventDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  eventType!: string;

  @IsString()
  @MinLength(1)
  entityType!: string;

  @IsString()
  @MinLength(1)
  entityId!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
