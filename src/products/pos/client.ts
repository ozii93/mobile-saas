/**
 * POS Live Mobile API Client
 * Connects to live POS backend endpoints: /api/v1/mobile/*
 * Adheres to OpenAPI 3.1: pos-mobile-v1.openapi.json & pos-mobile-v1.fixture.json
 * Uses per-branch isolated local Bearer token
 */

import {
  PosCategoryItem,
  PosCheckoutPayload,
  PosContextData,
  PosExchangeResponse,
  PosOrderItem,
  PosOrdersResponse,
  PosProductItem,
  PosShiftItem,
} from './types';
import { secureStorage } from '../../core/storage/secure-store';

export class PosApiException extends Error {
  public code: string;
  public status: number;
  public fields?: Record<string, string[]>;
  public requestId?: string;

  constructor(message: string, code: string, status: number, fields?: Record<string, string[]>, requestId?: string) {
    super(message);
    this.name = 'PosApiException';
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.requestId = requestId;
  }
}

export class PosClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(baseUrl?: string, timeoutMs = 15000) {
    this.baseUrl = (baseUrl || process.env.EXPO_PUBLIC_POS_API_URL || 'http://127.0.0.1:8002').replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  private generateRequestId(): string {
    return 'pos-req-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
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
      const token = await secureStorage.getProductToken('pos', tenantId, branchId);
      if (!token) {
        throw new PosApiException('Sesi produk POS belum aktif atau telah dicabut.', 'unauthenticated', 401, undefined, requestId);
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
        const message = errObj?.message || response.statusText || 'Terjadi kesalahan pada layanan POS.';
        const fields = errObj?.fields;
        const resRequestId = json?.meta?.request_id || requestId;

        throw new PosApiException(message, code, response.status, fields, resRequestId);
      }

      return json?.data !== undefined ? json.data : json;
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof PosApiException) {
        throw err;
      }

      if ((err as Error)?.name === 'AbortError') {
        throw new PosApiException('Koneksi ke backend POS timeout.', 'timeout', 408, undefined, requestId);
      }

      throw new PosApiException(
        (err as Error)?.message || 'Gagal terhubung ke backend POS.',
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
    signal?: AbortSignal
  ): Promise<PosExchangeResponse> {
    const data = await this.request<PosExchangeResponse>(
      '/api/v1/mobile/auth/exchange',
      tenantId,
      branchId,
      {
        method: 'POST',
        body: {
          ticket,
          operation_key: operationKey,
        },
        requireAuth: false,
        signal,
      }
    );

    if (data?.token) {
      await secureStorage.setProductToken('pos', tenantId, branchId, data.token);
    }

    return data;
  }

  /**
   * 2. GET /api/v1/mobile/context
   */
  public async getContext(tenantId: string, branchId: string, signal?: AbortSignal): Promise<PosContextData> {
    return this.request<PosContextData>('/api/v1/mobile/context', tenantId, branchId, {
      method: 'GET',
      signal,
    });
  }

  /**
   * 3. POST /api/v1/mobile/auth/logout
   */
  public async logout(tenantId: string, branchId: string): Promise<void> {
    try {
      await this.request<{ revoked: boolean }>('/api/v1/mobile/auth/logout', tenantId, branchId, {
        method: 'POST',
      });
    } finally {
      await secureStorage.removeProductToken('pos', tenantId, branchId);
    }
  }

  /**
   * 4. GET /api/v1/mobile/pos/products
   */
  public async getProducts(
    tenantId: string,
    branchId: string,
    options: { categoryId?: string; search?: string; perPage?: number } = {},
    signal?: AbortSignal
  ): Promise<PosProductItem[]> {
    const params = new URLSearchParams();
    if (options.categoryId) params.append('category_id', options.categoryId);
    if (options.search) params.append('search', options.search);
    if (options.perPage) params.append('per_page', options.perPage.toString());

    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<PosProductItem[]>(`/api/v1/mobile/pos/products${qs}`, tenantId, branchId, {
      method: 'GET',
      signal,
    });
  }

  /**
   * 5. GET /api/v1/mobile/pos/categories
   */
  public async getCategories(tenantId: string, branchId: string, signal?: AbortSignal): Promise<PosCategoryItem[]> {
    return this.request<PosCategoryItem[]>('/api/v1/mobile/pos/categories', tenantId, branchId, {
      method: 'GET',
      signal,
    });
  }

  /**
   * 6. GET /api/v1/mobile/pos/shifts/current
   */
  public async getCurrentShift(tenantId: string, branchId: string, signal?: AbortSignal): Promise<PosShiftItem | null> {
    return this.request<PosShiftItem | null>('/api/v1/mobile/pos/shifts/current', tenantId, branchId, {
      method: 'GET',
      signal,
    });
  }

  /**
   * 7. POST /api/v1/mobile/pos/shifts/open
   */
  public async openShift(
    tenantId: string,
    branchId: string,
    startingCash: number,
    notes?: string
  ): Promise<PosShiftItem> {
    return this.request<PosShiftItem>('/api/v1/mobile/pos/shifts/open', tenantId, branchId, {
      method: 'POST',
      body: { starting_cash: startingCash, notes },
    });
  }

  /**
   * 8. POST /api/v1/mobile/pos/shifts/close
   */
  public async closeShift(
    tenantId: string,
    branchId: string,
    actualCash: number,
    notes?: string
  ): Promise<PosShiftItem> {
    return this.request<PosShiftItem>('/api/v1/mobile/pos/shifts/close', tenantId, branchId, {
      method: 'POST',
      body: { actual_cash: actualCash, notes },
    });
  }

  /**
   * 9. POST /api/v1/mobile/pos/checkout
   * Idempotent checkout with operation_key
   */
  public async checkout(
    tenantId: string,
    branchId: string,
    payload: PosCheckoutPayload
  ): Promise<PosOrderItem> {
    return this.request<PosOrderItem>('/api/v1/mobile/pos/checkout', tenantId, branchId, {
      method: 'POST',
      body: payload,
    });
  }

  /**
   * 10. GET /api/v1/mobile/pos/orders (PLAN-002: Server-side pagination & filter)
   */
  public async getOrders(
    tenantId: string,
    branchId: string,
    options: { page?: number; search?: string; status?: string; paymentMethod?: string; perPage?: number } = {},
    signal?: AbortSignal
  ): Promise<PosOrdersResponse> {
    const params = new URLSearchParams();
    if (options.page) params.append('page', options.page.toString());
    if (options.perPage) params.append('per_page', options.perPage.toString());
    if (options.search) params.append('search', options.search);
    if (options.status) params.append('status', options.status);
    if (options.paymentMethod) params.append('payment_method', options.paymentMethod);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<any>(`/api/v1/mobile/pos/orders${qs}`, tenantId, branchId, {
      method: 'GET',
      signal,
    });

    if (res && res.orders && res.pagination) {
      return res as PosOrdersResponse;
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

    if (res && Array.isArray(res.data) && res.pagination) {
      return {
        orders: res.data,
        pagination: {
          current_page: res.pagination.current_page || 1,
          per_page: res.pagination.per_page || 20,
          total: res.pagination.total || res.data.length,
          total_pages: res.pagination.last_page || res.pagination.total_pages || 1,
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

  /**
   * 11. GET /api/v1/mobile/pos/orders/{id}
   */
  public async getOrderDetail(tenantId: string, branchId: string, orderId: string, signal?: AbortSignal): Promise<PosOrderItem> {
    return this.request<PosOrderItem>(`/api/v1/mobile/pos/orders/${orderId}`, tenantId, branchId, {
      method: 'GET',
      signal,
    });
  }

  /**
   * 12. POST /api/v1/mobile/pos/orders/{id}/void
   */
  public async voidOrder(
    tenantId: string,
    branchId: string,
    orderId: string,
    reason: string,
    operationKey: string
  ): Promise<PosOrderItem> {
    return this.request<PosOrderItem>(`/api/v1/mobile/pos/orders/${orderId}/void`, tenantId, branchId, {
      method: 'POST',
      body: {
        reason,
        operation_key: operationKey,
      },
    });
  }
}

export const posClient = new PosClient();
