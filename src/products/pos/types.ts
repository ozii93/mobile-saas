/**
 * POS Domain Types & DTOs
 * Strictly aligned with OpenAPI 3.1: pos-mobile-v1.openapi.json & pos-mobile-v1.fixture.json
 */

export interface PosContextData {
  identity_id: string;
  user_id: string;
  user_name: string;
  tenant_id: string;
  tenant_name: string;
  branch_id: string;
  branch_name: string;
  product_code: 'pos';
  role: 'owner' | 'cashier' | string;
  permissions: string[];
  entrypoint: string;
  expires_at?: string;
}

export interface PosExchangeResponse {
  token: string;
  token_type: 'Bearer';
  expires_at: string;
  context: PosContextData;
}

export interface PosCategoryItem {
  id: string;
  name: string;
  color?: string;
}

export interface PosProductItem {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  selling_price: number;
  cost_price?: number;
  unit?: string;
  track_stock?: boolean;
  current_stock: number;
  category: PosCategoryItem | null;
  image_url: string | null;
}

export interface PosCartLineItem {
  product: PosProductItem;
  quantity: number;
  unit_price: number;
  notes?: string;
  subtotal: number;
}

export interface PosShiftItem {
  id: string;
  status: 'open' | 'closed';
  starting_cash: number;
  opened_at: string;
  notes: string | null;
  total_sales?: number;
  transactions_count?: number;
}

export interface PosOrderItem {
  id: string;
  order_number: string;
  status: 'completed' | 'voided' | string;
  payment_method: 'cash' | 'qris' | 'transfer' | string;
  payment_status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  service_charge_amount: number;
  grand_total: number;
  payment_amount: number;
  change_amount: number;
  customer_name: string | null;
  table_number: string | null;
  notes: string | null;
  cashier_name?: string;
  created_at: string;
  items?: Array<{
    id: string;
    product_id: string;
    product_name: string;
    product_sku: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    notes?: string;
  }>;
}

export interface PaginationInfo {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_more?: boolean;
}

export interface PosOrdersResponse {
  orders: PosOrderItem[];
  pagination: PaginationInfo;
}

export interface PosCheckoutPayload {
  operation_key: string;
  payment_method: 'cash' | 'qris' | 'transfer';
  payment_amount: number;
  customer_name?: string;
  table_number?: string;
  discount_amount?: number;
  notes?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    notes?: string;
  }>;
}
