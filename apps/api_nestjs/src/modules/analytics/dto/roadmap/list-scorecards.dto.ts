import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ListRoadmapScorecardsDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsOptional()
  frequency?: 'weekly' | 'monthly';
}
