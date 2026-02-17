import { IsString, MaxLength } from 'class-validator';

export class AddTicketNoteDto {
  @IsString()
  @MaxLength(2000)
  note!: string;
}
