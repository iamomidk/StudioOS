import { IsString, MinLength } from 'class-validator';

export class NoteReconciliationDiscrepancyDto {
  @IsString()
  @MinLength(1)
  note!: string;
}
