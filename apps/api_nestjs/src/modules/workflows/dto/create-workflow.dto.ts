import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

const TRIGGER_EVENTS = [
  'lead_created',
  'lead_converted',
  'booking_created',
  'booking_updated',
  'rental_state_changed',
  'invoice_overdue',
  'invoice_paid',
  'dispute_opened',
  'dispute_resolved'
] as const;

const CONDITION_OPERATORS = ['AND', 'OR'] as const;

const ACTION_TYPES = [
  'send_notification',
  'create_ticket',
  'apply_label',
  'enqueue_job',
  'invoke_internal_endpoint'
] as const;

class TriggerDto {
  @IsIn(TRIGGER_EVENTS)
  eventType!: (typeof TRIGGER_EVENTS)[number];

  @IsOptional()
  @IsString()
  source?: string;
}

class ConditionGroupDto {
  @IsIn(CONDITION_OPERATORS)
  operator!: (typeof CONDITION_OPERATORS)[number];

  @IsOptional()
  @IsArray()
  conditions?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsArray()
  groups?: ConditionGroupDto[];
}

class ActionDto {
  @IsIn(ACTION_TYPES)
  actionType!: (typeof ACTION_TYPES)[number];

  @IsInt()
  @Min(0)
  orderIndex!: number;

  @IsObject()
  config!: Record<string, unknown>;
}

export class CreateWorkflowDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateNested()
  @Type(() => TriggerDto)
  trigger!: TriggerDto;

  @ValidateNested()
  @Type(() => ConditionGroupDto)
  conditionGroup!: ConditionGroupDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions!: ActionDto[];

  @IsOptional()
  @IsBoolean()
  dryRunEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  killSwitchEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxExecutionsPerHour?: number;

  @IsOptional()
  @IsISO8601()
  activationStartsAt?: string;

  @IsOptional()
  @IsISO8601()
  activationEndsAt?: string;
}

export type WorkflowTriggerEvent = (typeof TRIGGER_EVENTS)[number];
export type WorkflowActionType = (typeof ACTION_TYPES)[number];
