import { IsIn } from 'class-validator';

const INVOICE_STATUSES = [
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled'
] as const;

export type InvoiceLifecycleStatus = (typeof INVOICE_STATUSES)[number];

export class UpdateInvoiceStatusDto {
  @IsIn(INVOICE_STATUSES)
  status!: InvoiceLifecycleStatus;
}
