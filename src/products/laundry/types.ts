/**
 * Laundry Domain Types & DTOs
 * Aligned with Laundry routes/api.php and MobileBusinessApiController
 */

export interface LaundryTenantInfo {
  id: string;
  code: string;
  name: string;
}

export interface LaundryBranchInfo {
  id: string;
  code: string;
  name: string;
}

export interface LaundryUserInfo {
  id: string | number;
  name: string;
  role: string;
  role_label?: string;
  phone?: string | null;
}

export interface LaundryContextData {
  identity_id: string;
  product_code: 'laundry';
  tenant: LaundryTenantInfo;
  branch: LaundryBranchInfo;
  user: LaundryUserInfo;
  permissions: string[];
  entrypoints: string[];
  expires_at: string;
}

export interface LaundryExchangeResponse {
  token: string;
  token_type: 'Bearer';
  expires_at: string;
  context: LaundryContextData;
}

export interface LaundryOrderItem {
  id?: string;
  service_id?: string | number;
  service_name?: string;
  service_name_snapshot?: string;
  unit?: string;
  unit_snapshot?: string;
  quantity: number;
  unit_price?: number;
  price_snapshot?: number;
  subtotal: number;
  notes?: string;
}

export interface LaundryCustomer {
  id: string | number;
  name: string;
  phone: string;
  code?: string;
  address?: string;
}

export interface LaundryOrder {
  id: string;
  order_number: string;
  customer?: LaundryCustomer;
  customer_name?: string;
  customer_phone?: string;
  status: 'received' | 'washing' | 'ready_for_pickup' | 'delivered' | 'cancelled';
  status_label?: string;
  payment_status: 'unpaid' | 'partial' | 'paid';
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  items_count?: number;
  items?: LaundryOrderItem[];
  created_at: string;
}

export interface PaginationInfo {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_more?: boolean;
}

export interface LaundryOrdersResponse {
  orders: LaundryOrder[];
  pagination: PaginationInfo;
}

export interface LaundryServiceItem {
  id: string | number;
  name: string;
  unit: string;
  price: number;
  duration_hours?: number;
  category?: string;
}

export interface LaundryDeliveryTask {
  id: string;
  order_id: string;
  order_number: string;
  type: 'pickup' | 'delivery';
  customer_name: string;
  customer_phone: string;
  address: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'failed';
  notes?: string;
}

export interface LaundryCashierShift {
  shift_id: string;
  cashier_name: string;
  started_at: string;
  initial_cash: number;
  total_cash_received: number;
  orders_processed: number;
}
