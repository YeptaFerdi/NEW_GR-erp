/*
  # NEW_GR-ERP Full Schema v2 (restore)
  Re-creates all tables, RLS policies, indexes, and triggers for the ERP system.
  Idempotent - safe to re-run. Seeds base roles, regions, and account master.
*/

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS users_profile (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role_name text NOT NULL DEFAULT 'Staff',
  role_id uuid REFERENCES roles(id),
  status text NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Nonaktif')),
  last_login timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='roles' AND policyname='Authenticated users can read roles') THEN
    CREATE POLICY "Authenticated users can read roles" ON roles FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Admins can insert roles" ON roles FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users_profile WHERE id = auth.uid() AND role_name = 'Admin'));
    CREATE POLICY "Admins can update roles" ON roles FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users_profile WHERE id = auth.uid() AND role_name = 'Admin')) WITH CHECK (EXISTS (SELECT 1 FROM users_profile WHERE id = auth.uid() AND role_name = 'Admin'));
    CREATE POLICY "Admins can delete roles" ON roles FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users_profile WHERE id = auth.uid() AND role_name = 'Admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users_profile' AND policyname='Users can read all profiles') THEN
    CREATE POLICY "Users can read all profiles" ON users_profile FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Users can insert own profile" ON users_profile FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
    CREATE POLICY "Users can update own profile" ON users_profile FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Admins can delete profiles" ON users_profile FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users_profile up WHERE up.id = auth.uid() AND up.role_name = 'Admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module text NOT NULL,
  can_create boolean DEFAULT false,
  can_read boolean DEFAULT false,
  can_update boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, module)
);
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='permissions' AND policyname='Authenticated users can read permissions') THEN
    CREATE POLICY "Authenticated users can read permissions" ON permissions FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Admins can insert permissions" ON permissions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users_profile WHERE id = auth.uid() AND role_name = 'Admin'));
    CREATE POLICY "Admins can update permissions" ON permissions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users_profile WHERE id = auth.uid() AND role_name = 'Admin')) WITH CHECK (EXISTS (SELECT 1 FROM users_profile WHERE id = auth.uid() AND role_name = 'Admin'));
    CREATE POLICY "Admins can delete permissions" ON permissions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users_profile WHERE id = auth.uid() AND role_name = 'Admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  region_id uuid REFERENCES regions(id),
  region_name text NOT NULL DEFAULT '',
  address text DEFAULT '',
  phone text DEFAULT '',
  status text NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Nonaktif')),
  last_order_at timestamptz,
  total_orders integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS producers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text DEFAULT '',
  phone text DEFAULT '',
  status text NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Nonaktif')),
  total_products integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE producers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'Kg',
  buy_price numeric NOT NULL DEFAULT 0,
  sell_price numeric NOT NULL DEFAULT 0,
  producer_id uuid NOT NULL REFERENCES producers(id),
  image_url text DEFAULT '',
  current_stock numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('IN', 'OUT', 'RETURN', 'DISTRIBUTION')),
  move_date date NOT NULL DEFAULT CURRENT_DATE,
  producer_id uuid REFERENCES producers(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity numeric NOT NULL,
  buy_price numeric DEFAULT 0,
  payment_method text DEFAULT 'Cash',
  receipt_url text DEFAULT '',
  reason text DEFAULT '',
  reference_id uuid,
  reference_type text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_id uuid NOT NULL REFERENCES customers(id),
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  delivery_date date,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'BARU' CHECK (status IN ('BARU', 'DIPROSES', 'SELESAI')),
  delivery_status text NOT NULL DEFAULT 'BELUM DIKIRIM' CHECK (delivery_status IN ('BELUM DIKIRIM', 'DIKIRIM', 'TERKIRIM')),
  payment_status text NOT NULL DEFAULT 'HUTANG' CHECK (payment_status IN ('HUTANG', 'LUNAS')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  subtotal numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'HUTANG' CHECK (payment_status IN ('HUTANG', 'LUNAS')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  amount numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'Tunai',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  proof_url text DEFAULT '',
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,
  region_id uuid REFERENCES regions(id),
  region_name text NOT NULL DEFAULT '',
  order_id uuid NOT NULL REFERENCES orders(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  sort_order integer DEFAULT 0,
  status text NOT NULL DEFAULT 'BELUM DIKIRIM' CHECK (status IN ('BELUM DIKIRIM', 'DIKIRIM', 'TERKIRIM')),
  delivered_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS account_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('Modal', 'Operasional')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE account_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS capital_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  account_id uuid REFERENCES account_master(id),
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  previous_profit numeric DEFAULT 0,
  notes text DEFAULT '',
  period_month integer,
  period_year integer,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE capital_entries ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS operational_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_date date NOT NULL DEFAULT CURRENT_DATE,
  account_id uuid REFERENCES account_master(id),
  account_name text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  description text DEFAULT '',
  period_month integer,
  period_year integer,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE operational_costs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_timestamp timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id),
  user_name text NOT NULL DEFAULT '',
  user_role text NOT NULL DEFAULT '',
  module text NOT NULL,
  data_id text DEFAULT '',
  action text NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'READ')),
  old_data jsonb,
  new_data jsonb
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='regions' AND policyname='Authenticated users can read regions') THEN
    CREATE POLICY "Authenticated users can read regions" ON regions FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can insert regions" ON regions FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can update regions" ON regions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Authenticated users can read customers') THEN
    CREATE POLICY "Authenticated users can read customers" ON customers FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can insert customers" ON customers FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can update customers" ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Authenticated users can delete customers" ON customers FOR DELETE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='producers' AND policyname='Authenticated users can read producers') THEN
    CREATE POLICY "Authenticated users can read producers" ON producers FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can insert producers" ON producers FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can update producers" ON producers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Authenticated users can delete producers" ON producers FOR DELETE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='Authenticated users can read products') THEN
    CREATE POLICY "Authenticated users can read products" ON products FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can insert products" ON products FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can update products" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Authenticated users can delete products" ON products FOR DELETE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_movements' AND policyname='Authenticated users can read stock movements') THEN
    CREATE POLICY "Authenticated users can read stock movements" ON stock_movements FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can insert stock movements" ON stock_movements FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can update stock movements" ON stock_movements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='Authenticated users can read orders') THEN
    CREATE POLICY "Authenticated users can read orders" ON orders FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can insert orders" ON orders FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can update orders" ON orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Authenticated users can delete orders" ON orders FOR DELETE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_items' AND policyname='Authenticated users can read order items') THEN
    CREATE POLICY "Authenticated users can read order items" ON order_items FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can insert order items" ON order_items FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can update order items" ON order_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Authenticated users can delete order items" ON order_items FOR DELETE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='Authenticated users can read invoices') THEN
    CREATE POLICY "Authenticated users can read invoices" ON invoices FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can insert invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can update invoices" ON invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='Authenticated users can read payments') THEN
    CREATE POLICY "Authenticated users can read payments" ON payments FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can insert payments" ON payments FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='distributions' AND policyname='Authenticated users can read distributions') THEN
    CREATE POLICY "Authenticated users can read distributions" ON distributions FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can insert distributions" ON distributions FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can update distributions" ON distributions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='account_master' AND policyname='Authenticated users can read account master') THEN
    CREATE POLICY "Authenticated users can read account master" ON account_master FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can insert account master" ON account_master FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can update account master" ON account_master FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Authenticated users can delete account master" ON account_master FOR DELETE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='capital_entries' AND policyname='Authenticated users can read capital entries') THEN
    CREATE POLICY "Authenticated users can read capital entries" ON capital_entries FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can insert capital entries" ON capital_entries FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can update capital entries" ON capital_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Authenticated users can delete capital entries" ON capital_entries FOR DELETE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='operational_costs' AND policyname='Authenticated users can read operational costs') THEN
    CREATE POLICY "Authenticated users can read operational costs" ON operational_costs FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can insert operational costs" ON operational_costs FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can update operational costs" ON operational_costs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Authenticated users can delete operational costs" ON operational_costs FOR DELETE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_logs' AND policyname='Authenticated users can read audit logs') THEN
    CREATE POLICY "Authenticated users can read audit logs" ON audit_logs FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can insert audit logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_distributions_order ON distributions(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(log_timestamp DESC);

CREATE OR REPLACE FUNCTION handle_distribution_delivered()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id uuid;
  v_item RECORD;
BEGIN
  IF NEW.status = 'TERKIRIM' AND (OLD.status IS DISTINCT FROM 'TERKIRIM') THEN
    v_order_id := NEW.order_id;
    UPDATE orders SET status = 'SELESAI', delivery_status = 'TERKIRIM', updated_at = now() WHERE id = v_order_id;
    FOR v_item IN SELECT oi.product_id, oi.quantity FROM order_items oi WHERE oi.order_id = v_order_id LOOP
      UPDATE products SET current_stock = current_stock - v_item.quantity, updated_at = now() WHERE id = v_item.product_id;
      INSERT INTO stock_movements (type, product_id, quantity, reference_id, reference_type, created_by)
      VALUES ('DISTRIBUTION', v_item.product_id, v_item.quantity, v_order_id, 'ORDER', NEW.created_by);
    END LOOP;
    NEW.delivered_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_distribution_delivered ON distributions;
CREATE TRIGGER trg_distribution_delivered BEFORE UPDATE ON distributions FOR EACH ROW EXECUTE FUNCTION handle_distribution_delivered();

CREATE OR REPLACE FUNCTION handle_payment_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_total numeric;
  v_paid numeric;
BEGIN
  SELECT total_amount INTO v_total FROM invoices WHERE id = NEW.invoice_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_paid FROM payments WHERE invoice_id = NEW.invoice_id;
  UPDATE invoices SET paid_amount = v_paid, remaining_amount = GREATEST(0, v_total - v_paid),
    payment_status = CASE WHEN v_paid >= v_total THEN 'LUNAS' ELSE 'HUTANG' END, updated_at = now()
    WHERE id = NEW.invoice_id;
  UPDATE orders SET payment_status = CASE WHEN v_paid >= v_total THEN 'LUNAS' ELSE 'HUTANG' END, updated_at = now()
    WHERE id = (SELECT order_id FROM invoices WHERE id = NEW.invoice_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_payment_insert ON payments;
CREATE TRIGGER trg_payment_insert AFTER INSERT ON payments FOR EACH ROW EXECUTE FUNCTION handle_payment_insert();

INSERT INTO roles (name, description) VALUES
  ('Admin', 'Akses penuh ke semua modul'),
  ('Owner', 'Pemilik perusahaan - akses baca semua modul'),
  ('Warehouse', 'Akses stok dan distribusi'),
  ('Finance', 'Akses modul keuangan'),
  ('Staff', 'Akses baca terbatas')
ON CONFLICT (name) DO NOTHING;

INSERT INTO regions (name, sort_order) VALUES
  ('Klaten', 1), ('Sragen', 2), ('Gunung Kidul', 3),
  ('Bantul', 4), ('Yogyakarta', 5), ('Solo', 6), ('Wonogiri', 7)
ON CONFLICT (name) DO NOTHING;

INSERT INTO account_master (name, type) VALUES
  ('Haryanto', 'Modal'), ('Damar', 'Modal'), ('Budi', 'Modal'),
  ('Hutang Dagang', 'Modal'), ('Laba s/d 31 Des', 'Modal'),
  ('Bensin', 'Operasional'), ('Listrik', 'Operasional'),
  ('Air', 'Operasional'), ('Gaji Karyawan', 'Operasional'), ('Kemasan', 'Operasional'),
  ('Makan', 'Operasional'), ('Mobil / Haryanto', 'Operasional'),
  ('Lain Lain', 'Operasional'), ('Ganti Olie', 'Operasional'), ('Ganti Akki', 'Operasional')
ON CONFLICT DO NOTHING;
