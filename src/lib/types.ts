export type UserStatus = 'Aktif' | 'Nonaktif';
export type OrderStatus = 'BARU' | 'DIPROSES' | 'SELESAI' | 'BATAL';
export type DeliveryStatus = 'BELUM DIKIRIM' | 'DIKIRIM' | 'TERKIRIM' | 'BATAL';
export type PaymentStatus = 'HUTANG' | 'LUNAS' | 'BATAL';
export type StockMoveType = 'IN' | 'OUT' | 'RETURN' | 'DISTRIBUTION';
export type ActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'READ';
export type AccountType = 'Modal' | 'Operasional';

export interface Role {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface Permission {
  id: string;
  role_id: string;
  module: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role_name: string;
  role_id: string | null;
  status: UserStatus;
  last_login: string | null;
  address: string;
  phone: string;
  avatar_url: string;
  created_at: string;
}

export interface Region {
  id: string;
  name: string;
  sort_order: number;
}

export interface Customer {
  id: string;
  name: string;
  region_id: string | null;
  region_name: string;
  address: string;
  phone: string;
  status: UserStatus;
  last_order_at: string | null;
  total_orders: number;
  created_at: string;
}

export interface Producer {
  id: string;
  name: string;
  address: string;
  phone: string;
  status: UserStatus;
  total_products: number;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  buy_price: number;
  sell_price: number;
  producer_id: string;
  image_url: string;
  current_stock: number;
  status: UserStatus;
  created_at: string;
  producers?: { name: string };
}

export interface StockMovement {
  id: string;
  type: StockMoveType;
  move_date: string;
  producer_id: string | null;
  product_id: string;
  quantity: number;
  buy_price: number;
  payment_method: string;
  receipt_url: string;
  reason: string;
  reference_id: string | null;
  reference_type: string;
  created_by: string | null;
  created_at: string;
  products?: { name: string; unit: string };
  producers?: { name: string };
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  order_date: string;
  delivery_date: string | null;
  total_amount: number;
  status: OrderStatus;
  delivery_status: DeliveryStatus;
  payment_status: PaymentStatus;
  cancelled_at: string | null;
  cancel_reason: string;
  created_by: string | null;
  created_at: string;
  customers?: { name: string; region_name: string };
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products?: { name: string; unit: string };
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  customer_id: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: PaymentStatus;
  cancelled_at: string | null;
  cancel_reason: string;
  created_at: string;
  customers?: { name: string };
  orders?: { order_number: string; delivery_date: string | null };
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  proof_url: string;
  notes: string;
  created_at: string;
}

export interface Distribution {
  id: string;
  delivery_date: string;
  region_id: string | null;
  region_name: string;
  order_id: string;
  customer_id: string;
  sort_order: number;
  status: DeliveryStatus;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string;
  created_at: string;
  orders?: { order_number: string; total_amount: number };
  customers?: { name: string; region_name?: string };
}

export interface AccountMaster {
  id: string;
  name: string;
  type: AccountType;
  created_at: string;
}

export interface CapitalEntry {
  id: string;
  entry_date: string;
  account_id: string | null;
  name: string;
  amount: number;
  previous_profit: number;
  notes: string;
  period_month: number | null;
  period_year: number | null;
  created_at: string;
}

export interface OperationalCost {
  id: string;
  cost_date: string;
  account_id: string | null;
  account_name: string;
  amount: number;
  description: string;
  period_month: number | null;
  period_year: number | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  log_timestamp: string;
  user_id: string | null;
  user_name: string;
  user_role: string;
  module: string;
  data_id: string;
  action: ActionType;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}
