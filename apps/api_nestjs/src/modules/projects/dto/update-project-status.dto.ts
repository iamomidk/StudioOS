import { IsIn } from 'class-validator';

const PROJECT_STATUSES = ['preprod', 'shoot', 'edit', 'review', 'delivered', 'closed'] as const;

export type ProjectWorkflowStatus = (typeof PROJECT_STATUSES)[number];

export class UpdateProjectStatusDto {
  @IsIn(PROJECT_STATUSES)
  status!: ProjectWorkflowStatus;
}
