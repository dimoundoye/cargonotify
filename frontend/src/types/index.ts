export interface User {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'logistics' | 'cashier' | 'agent' | string;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  allowed_tabs?: string[] | null;
  is_active?: boolean;
  created_at?: string;
}

export interface ContainerCost {
  id: number;
  container_id: number;
  category: 'freight' | 'customs' | 'transport' | 'other' | string;
  amount: number;
  description?: string;
  created_at?: string;
}

export interface Container {
  id: number;
  container_number: string;
  bl_number?: string | null;
  shipping_line?: string | null;
  agent_name?: string | null;
  origin: string;
  loading_date?: string | null;
  expected_arrival?: string | null;
  actual_arrival?: string | null;
  status: 'in_transit' | 'arrived' | 'closed';
  notes?: string | null;
  total_costs?: number;
  total_lots?: number;
  total_clients?: number;
  total_revenue?: number;
  lots_count?: number;
  revenue?: number;
  costs?: ContainerCost[];
  lots?: Lot[];
  created_at?: string;
}

export interface Client {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  total_lots?: number;
  total_billed?: number;
  total_paid?: number;
  total_due?: number;
  lots?: Lot[];
  payments?: Payment[];
}

export interface Warehouse {
  id: number;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  is_default_pickup?: boolean | null;
}

export interface PricingService {
  id: number;
  code: string;
  name: string;
  default_rate: number;
  unit_type: 'per_cbm' | 'per_unit';
  description?: string;
  is_active: boolean;
}

export interface LotServiceItem {
  id?: number;
  lot_id?: number;
  service_id?: number | null;
  service_name: string;
  quantity: number;
  rate: number;
  line_total: number;
}

export interface Lot {
  id: number;
  container_id: number;
  client_id: number;
  warehouse_id?: number | null;
  product_description: string;
  quantity: number;
  weight_kg: number;
  volume_cbm: number;
  cbm_rate?: number;
  cbm_amount?: number;
  bale_qty?: number;
  bale_amount?: number;
  copy_qty?: number;
  copy_amount?: number;
  small_packing_qty?: number;
  small_packing_amount?: number;
  heavy_goods_qty?: number;
  heavy_goods_amount?: number;
  suggested_amount: number;
  final_amount: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  pickup_status: 'pending' | 'picked_up';
  pickup_date?: string | null;
  exit_date?: string | null;
  notes?: string | null;
  client_name?: string;
  client_phone?: string;
  container_number?: string;
  container_origin?: string;
  warehouse_name?: string;
  total_paid?: number;
  remaining_balance?: number;
  services?: LotServiceItem[];
  payments?: Payment[];
  created_at?: string;
}

export interface Payment {
  id: number;
  lot_id: number;
  client_id: number;
  amount_paid: number;
  payment_date: string;
  payment_method: 'cash' | 'wave' | 'om' | 'bank_transfer';
  receipt_number: string;
  notes?: string | null;
  client_name?: string;
  client_phone?: string;
  product_description?: string;
  container_number?: string;
}

export interface DashboardStats {
  total_revenue: number;
  total_collected: number;
  total_due: number;
  total_costs: number;
  total_company_expenses?: number;
  total_container_costs?: number;
  net_profit: number;
  net_cash_balance: number;
  total_clients: number;
  total_containers: number;
  in_transit_count: number;
  arrived_count: number;
  closed_count: number;
}

export interface ContainerProfitability {
  id: number;
  container_number: string;
  origin: string;
  status: string;
  container_costs: number;
  container_revenue: number;
  net_profit: number;
}

export interface Expense {
  id: number;
  company_id?: number;
  container_id?: number | null;
  container_number?: string | null;
  container_origin?: string | null;
  category: 'salary' | 'transport' | 'handling' | 'container' | 'rent' | 'other' | string;
  title: string;
  amount: number;
  expense_date: string;
  notes?: string | null;
  created_at?: string;
}

export interface AuditLog {
  id: number;
  company_id?: number;
  user_id?: number | null;
  user_name: string;
  user_email: string;
  action: string;
  action_type: 'create' | 'update' | 'delete' | 'auth' | 'communication' | 'export' | string;
  entity_type?: string | null;
  entity_id?: number | null;
  description: string;
  metadata?: any;
  created_at: string;
}
