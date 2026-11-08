/**
 * Core Platform Public Mobile API Client
 * Interacts only with Core Public API endpoints (never calls internal integration endpoints)
 * Never logs authorization tokens or passwords
 */

import {
  ApiResponse,
  CustomerIdentity,
  DeviceSession,
  EffectiveDirectory,
  LoginResult,
  ProductTicket,
} from '../types';
import { secureStorage } from '../storage/secure-store';

export class CoreApiException extends Error {
  public code: string;
  public status: number;
  public fields?: Record<string, string[]>;
  public requestId?: string;

  constructor(message: string, code: string, status: number, fields?: Record<string, string[]>, requestId?: string) {
    super(message);
    this.name = 'CoreApiException';
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.requestId = requestId;
  }
}

export class CoreClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(baseUrl?: string, timeoutMs = 15000) {
    this.baseUrl = (baseUrl || process.env.EXPO_PUBLIC_CORE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  private generateRequestId(): string {
    return 'req-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      requireAuth?: boolean;
      signal?: AbortSignal;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', body, requireAuth = true, signal } = options;
    const url = `${this.baseUrl}${endpoint}`;
    const requestId = this.generateRequestId();

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
    };

    if (requireAuth) {
      const token = await secureStorage.getCoreToken();
      if (!token) {
        throw new CoreApiException('Sesi pusat belum aktif atau kedaluwarsa.', 'unauthenticated', 401, undefined, requestId);
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
        const message = errObj?.message || response.statusText || 'Terjadi kesalahan pada server Core.';
        const fields = errObj?.fields;
        const resRequestId = json?.meta?.request_id || requestId;

        throw new CoreApiException(message, code, response.status, fields, resRequestId);
      }

      return json as ApiResponse<T>;
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof CoreApiException) {
        throw err;
      }

      if ((err as Error)?.name === 'AbortError') {
        throw new CoreApiException('Koneksi ke Core Platform timeout. Silakan periksa jaringan Anda.', 'timeout', 408, undefined, requestId);
      }

      throw new CoreApiException(
        (err as Error)?.message || 'Gagal terhubung ke Core Platform.',
        'network_error',
        0,
        undefined,
        requestId
      );
    }
  }

  /**
   * 1. POST /api/v1/mobile/auth/login
   */
  public async login(email: string, password: string, deviceName = 'Mobile Device'): Promise<LoginResult> {
    const res = await this.request<LoginResult>('/api/v1/mobile/auth/login', {
      method: 'POST',
      body: { email, password, device_name: deviceName },
      requireAuth: false,
    });

    if (res.data?.token) {
      await secureStorage.setCoreToken(res.data.token);
    }

    return res.data;
  }

  /**
   * 2. GET /api/v1/mobile/me
   */
  public async getMe(signal?: AbortSignal): Promise<{ identity: CustomerIdentity; session: DeviceSession }> {
    const res = await this.request<{ identity: CustomerIdentity; session: DeviceSession }>('/api/v1/mobile/me', {
      method: 'GET',
      signal,
    });
    return res.data;
  }

  /**
   * 3. GET /api/v1/mobile/access
   */
  public async getAccessDirectory(signal?: AbortSignal): Promise<EffectiveDirectory> {
    const res = await this.request<EffectiveDirectory>('/api/v1/mobile/access', {
      method: 'GET',
      signal,
    });
    return res.data;
  }

  /**
   * 4. POST /api/v1/mobile/product-tickets
   */
  public async requestProductTicket(
    tenantId: string,
    productCode: string,
    branchId: string,
    signal?: AbortSignal
  ): Promise<ProductTicket> {
    const res = await this.request<ProductTicket>('/api/v1/mobile/product-tickets', {
      method: 'POST',
      body: {
        tenant_id: tenantId,
        product_code: productCode,
        branch_id: branchId,
      },
      signal,
    });
    return res.data;
  }

  /**
   * 5. POST /api/v1/mobile/auth/logout
   */
  public async logout(all = false): Promise<void> {
    try {
      await this.request<{ revoked: boolean }>('/api/v1/mobile/auth/logout', {
        method: 'POST',
        body: { all },
      });
    } finally {
      await secureStorage.clearAllTokens();
    }
  }

  /**
   * 6. GET /api/v1/mobile/sessions
   */
  public async getSessions(): Promise<DeviceSession[]> {
    const res = await this.request<DeviceSession[]>('/api/v1/mobile/sessions', {
      method: 'GET',
    });
    return res.data;
  }

  /**
   * 7. DELETE /api/v1/mobile/sessions/:id
   */
  public async deleteSession(sessionId: string): Promise<void> {
    await this.request<{ revoked: boolean }>(`/api/v1/mobile/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * 8. POST /api/v1/mobile/links (Claim Link Challenge)
   */
  public async claimLinkChallenge(challenge: string): Promise<{ linked: boolean }> {
    const res = await this.request<{ linked: boolean }>('/api/v1/mobile/links', {
      method: 'POST',
      body: { challenge },
    });
    return res.data;
  }
}

export const coreClient = new CoreClient();
