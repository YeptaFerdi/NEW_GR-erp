-- Add BATAL to invoices payment_status constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_payment_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_payment_status_check CHECK (payment_status IN ('HUTANG', 'LUNAS', 'BATAL'));

-- Add cancelled_at and cancel_reason to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancel_reason text DEFAULT '';