-- Add BATAL status to orders.status CHECK constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('BARU', 'DIPROSES', 'SELESAI', 'BATAL'));

-- Add BATAL status to distributions.status CHECK constraint  
ALTER TABLE distributions DROP CONSTRAINT IF EXISTS distributions_status_check;
ALTER TABLE distributions ADD CONSTRAINT distributions_status_check CHECK (status IN ('BELUM DIKIRIM', 'DIKIRIM', 'TERKIRIM', 'BATAL'));

-- Add cancelled_at timestamp columns (nullable)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason text DEFAULT '';

ALTER TABLE distributions ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS cancel_reason text DEFAULT '';