import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListSupportTicketsDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @IsIn(['open', 'triaged', 'in_progress', 'resolved', 'closed'])
  status?: 'open' | 'triaged' | 'in_progress' | 'resolved' | 'closed';

  @IsOptional()
  @IsIn(['p0', 'p1', 'p2', 'p3'])
  severity?: 'p0' | 'p1' | 'p2' | 'p3';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
