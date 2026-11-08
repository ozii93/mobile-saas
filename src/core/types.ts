/**
 * Core Platform Mobile v1 Data Transfer Objects & Interfaces
 * Matches Core OpenAPI 3.1 & backend controller specs
 */

export interface ApiResponse<T> {
  data: T;
  meta?: {
    contract_version: number;
    request_id: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
  meta?: {
    contract_version: number;
    request_id: string;
  };
}

export interface CustomerIdentity {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: 'active' | 'suspended';
  email_verified_at: string | null;
  auth_version: number;
  access_version: number;
  mfa_required?: boolean;
}

export interface DeviceSession {
  id: string;
  identity_id: string;
  device_name: string | null;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
}

export interface LoginResult {
  token: string;
  token_type: 'Bearer';
  session: DeviceSession;
  identity: CustomerIdentity;
}

export interface EffectiveBranch {
  branch_id: string;
  name: string;
}

export type ProductAvailability =
  | 'available'
  | 'subscription_expired'
  | 'provisioning_pending'
  | 'product_unavailable'
  | 'identity_inactive'
  | 'access_denied'
  | 'branch_unavailable';

export interface EffectiveProduct {
  product_code: 'pos' | 'laundry' | string;
  grant_id: string;
  grant_version: number;
  availability: ProductAvailability;
  branch_scope: 'all' | 'selected';
  branches: EffectiveBranch[];
}

export interface EffectiveTenant {
  tenant_id: string;
  name: string;
  role: 'owner' | 'staff';
  products: EffectiveProduct[];
}

export interface EffectiveDirectory {
  identity_id: string;
  access_version: number;
  tenants: EffectiveTenant[];
}

export interface ProductTicket {
  ticket: string;
  expires_at: string;
  tenant_id: string;
  product_code: string;
  branch_id: string;
}

export interface ActiveContext {
  tenant_id: string;
  tenant_name: string;
  product_code: 'pos' | 'laundry' | string;
  branch_id: string;
  branch_name: string;
  role: 'owner' | 'staff';
}

export type AuthStateStatus =
  | 'logged_out'
  | 'authenticating'
  | 'loading_access'
  | 'no_access'
  | 'access_unavailable'
  | 'selecting_context'
  | 'exchanging_product_session'
  | 'loading_product_context'
  | 'ready'
  | 'exchange_outcome_unknown';
