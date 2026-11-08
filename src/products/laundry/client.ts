/**
 * Laundry Live Mobile Client
 * Connects to live Laundry backend endpoints: /api/v1/mobile/*
 * Uses per-branch isolated local Bearer token
 */

import {
  LaundryCashierShift,
  LaundryContextData,
  LaundryCustomer,
  LaundryDeliveryTask,
  LaundryExchangeResponse,
  LaundryOrder,
  LaundryOrdersResponse,
  LaundryServiceItem,
} from './types';
import { secureStorage } from '../../core/storage/secure-store';

export class LaundryApiException extends Error {
  public code: string;
  public status: number;
  public fields?: Record<string, string[]>;
  public requestId?: string;

  constructor(message: string, code: string, status: number, fields?: Record<string, string[]>, requestId?: string) {
    super(message);
    this.name = 'LaundryApiException';
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.requestId = requestId;
  }
}

export class LaundryClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(baseUrl?: string, timeoutMs = 15000) {
    this.baseUrl = (baseUrl || process.env.EXPO_PUBLIC_LAUNDRY_API_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  private generateRequestId(): string {
    return 'laundry-req-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
  }

  private async request<T>(
    endpoint: string,
    tenantId: string,
    branchId: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      requireAuth?: boolean;
      signal?: AbortSignal;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, requireAuth = true, signal } = options;
    const url = `${this.baseUrl}${endpoint}`;
    const requestId = this.generateRequestId();

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
      'X-Tenant-Id': tenantId,
      'X-Branch-Id': branchId,
    };

    if (requireAuth) {
      const token = await secureStorage.getProductToken('laundry', tenantId, branchId);
      if (!token) {
        throw new LaundryApiException('Sesi produk laundry belum aktif atau telah dicabut.', 'unauthenticated', 401, undefined, requestId);
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const combinedSignal = signal || controller.signal;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: combinedSignal,
      });

      clearTimeout(timer);

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const errObj = json?.error;
        const code = errObj?.code || `http_${response.status}`;
        const message = errObj?.message || response.statusText || 'Terjadi kesalahan pada layanan Laundry.';
        const fields = errObj?.fields;
        const resRequestId = json?.meta?.request_id || requestId;

        throw new LaundryApiException(message, code, response.status, fields, resRequestId);
      }

      return json?.data !== undefined ? json.data : json;
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof LaundryApiException) {
        throw err;
      }

      if ((err as Error)?.name === 'AbortError') {
        throw new LaundryApiException('Koneksi ke backend Laundry timeout.', 'timeout', 408, undefined, requestId);
      }

      throw new LaundryApiException(
        (err as Error)?.message || 'Gagal terhubung ke backend Laundry.',
        'network_error',
        0,
        undefined,
        requestId
      );
    }
  }

  /**
   * 1. POST /api/v1/mobile/auth/exchange
   * Menukarkan tiket 60 detik dari Core dengan operation_key UUID idempotensi
   */
  public async exchangeTicket(
    tenantId: string,
    branchId: string,
    ticket: string,
    operationKey: string,
    deviceName = 'Mobile Device',
    signal?: AbortSignal
  ): Promise<LaundryExchangeResponse> {
    const data = await this.request<LaundryExchangeResponse>(
      '/api/v1/mobile/auth/exchange',
      tenantId,
      branchId,
      {
        method: 'POST',
        body: {
          ticket,
          operation_key: operationKey,
          device_name: deviceName,
        },
        requireAuth: false,
        signal,
      }
    );

    if (data?.token) {
      await secureStorage.setProductToken('laundry', tenantId, branchId, data.token);
    }

    return data;
  }

  /**
   * 2. GET /api/v1/mobile/context
   */
  public async getContext(tenantId: string, branchId: string, signal?: AbortSignal): Promise<LaundryContextData> {
    return this.request<LaundryContextData>('/api/v1/mobile/context', tenantId, branchId, {
      method: 'GET',
      signal,
    });
  }

  /**
   * 3. POST /api/v1/mobile/auth/logout
   */
  public async logout(tenantId: string, branchId: string): Promise<void> {
    try {
      await this.request<{ success: boolean }>('/api/v1/mobile/auth/logout', tenantId, branchId, {
        method: 'POST',
      });
    } finally {
      await secureStorage.removeProductToken('laundry', tenantId, branchId);
    }
  }

  /**
   * 4. Orders API with server-side pagination and filter (PLAN-002)
   */
  public async getOrders(
    tenantId: string,
    branchId: string,
    options: { page?: number; perPage?: number; search?: string; status?: string } = {},
    signal?: AbortSignal
  ): Promise<LaundryOrdersResponse> {
    const params = new URLSearchParams();
    if (options.page) params.append('page', options.page.toString());
    if (options.perPage) params.append('per_page', options.perPage.toString());
    if (options.search) params.append('search', options.search);
    if (options.status && options.status !== 'all') params.append('status', options.status);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<any>(`/api/v1/mobile/orders${qs}`, tenantId, branchId, {
      method: 'GET',
      signal,
    });

    if (res && res.orders && res.pagination) {
      return res as LaundryOrdersResponse;
    }

    if (Array.isArray(res)) {
      return {
        orders: res,
        pagination: {
          current_page: 1,
          per_page: res.length,
          total: res.length,
          total_pages: 1,
          has_more: false,
        },
      };
    }

    return {
      orders: [],
      pagination: {
        current_page: 1,
        per_page: 20,
        total: 0,
        total_pages: 1,
        has_more: false,
      },
    };
  }

  public async getOrderDetail(tenantId: string, branchId: string, orderId: string, signal?: AbortSignal): Promise<LaundryOrder> {
    return this.request<LaundryOrder>(`/api/v1/mobile/orders/${orderId}`, tenantId, branchId, {
      method: 'GET',
      signal,
    });
  }

  public async createOrder(
    tenantId: string,
    branchId: string,
    payload: {
      customer_id?: string | number;
      customer_name?: string;
      customer_phone?: string;
      items: Array<{
        service_id: string | number;
        quantity: number;
        notes?: string;
      }>;
      operation_key: string;
    }
  ): Promise<LaundryOrder> {
    return this.request<LaundryOrder>('/api/v1/mobile/orders', tenantId, branchId, {
      method: 'POST',
      body: payload,
    });
  }

  public async transitionOrder(
    tenantId: string,
    branchId: string,
    orderId: string,
    targetStatus: string,
    operationKey: string
  ): Promise<LaundryOrder> {
    return this.request<LaundryOrder>(`/api/v1/mobile/orders/${orderId}/transition`, tenantId, branchId, {
      method: 'POST',
      body: {
        status: targetStatus,
        operation_key: operationKey,
      },
    });
  }

  public async recordPayment(
    tenantId: string,
    branchId: string,
    orderId: string,
    amount: number,
    paymentMethod: string,
    operationKey: string
  ): Promise<{ order: LaundryOrder; payment_id: string }> {
    return this.request<{ order: LaundryOrder; payment_id: string }>(
      `/api/v1/mobile/orders/${orderId}/payments`,
      tenantId,
      branchId,
      {
        method: 'POST',
        body: {
          amount,
          payment_method: paymentMethod,
          operation_key: operationKey,
        },
      }
    );
  }

  /**
   * 5. Deliveries API
   */
  public async getDeliveries(tenantId: string, branchId: string): Promise<LaundryDeliveryTask[]> {
    return this.request<LaundryDeliveryTask[]>('/api/v1/mobile/deliveries', tenantId, branchId, {
      method: 'GET',
    });
  }

  /**
   * 6. Services & Customers Master API
   */
  public async getServices(tenantId: string, branchId: string): Promise<LaundryServiceItem[]> {
    return this.request<LaundryServiceItem[]>('/api/v1/mobile/services', tenantId, branchId, {
      method: 'GET',
    });
  }

  public async getCustomers(tenantId: string, branchId: string): Promise<LaundryCustomer[]> {
    return this.request<LaundryCustomer[]>('/api/v1/mobile/customers', tenantId, branchId, {
      method: 'GET',
    });
  }

  public async createCustomer(
    tenantId: string,
    branchId: string,
    customer: { name: string; phone: string; address?: string }
  ): Promise<LaundryCustomer> {
    return this.request<LaundryCustomer>('/api/v1/mobile/customers', tenantId, branchId, {
      method: 'POST',
      body: customer,
    });
  }

  /**
   * 7. Shift Info
   */
  public async getCashierShift(tenantId: string, branchId: string): Promise<LaundryCashierShift> {
    return this.request<LaundryCashierShift>('/api/v1/mobile/cashier/shift', tenantId, branchId, {
      method: 'GET',
    });
  }
}

export const laundryClient = new LaundryClient();
