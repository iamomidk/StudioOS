import { IsIn } from 'class-validator';

export class UpdateTicketStatusDto {
  @IsIn(['open', 'triaged', 'in_progress', 'resolved', 'closed'])
  status!: 'open' | 'triaged' | 'in_progress' | 'resolved' | 'closed';
}
