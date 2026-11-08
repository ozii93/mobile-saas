/**
 * PLAN-002 Resilience & Pagination Tests
 * Verifies server-side pagination, search & status query params formatting,
 * void order with operation_key idempotency, and error handling with correlation IDs.
 */

import { laundryClient } from '../src/products/laundry/client';
import { posClient } from '../src/products/pos/client';
import { syntheticLaundryAdapter } from '../src/products/laundry/fixture';
import { syntheticPosAdapter } from '../src/products/pos/fixture';
import { secureStorage } from '../src/core/storage/secure-store';

describe('PLAN-002: Server-side Pagination & Void Resilience', () => {
  const tenantId = 'tenant-test-01';
  const branchId = 'branch-test-01';
  const mockToken = 'test-token-jwt-secret';

  beforeAll(async () => {
    // Seed product tokens in isolated secure storage
    await secureStorage.setProductToken('pos', tenantId, branchId, mockToken);
    await secureStorage.setProductToken('laundry', tenantId, branchId, mockToken);
  });

  afterAll(async () => {
    await secureStorage.removeProductToken('pos', tenantId, branchId);
    await secureStorage.removeProductToken('laundry', tenantId, branchId);
  });

  describe('Laundry Pagination & Filtering', () => {
    it('formats query string correctly for page, per_page, search, and status', async () => {
      const originalFetch = global.fetch;
      let requestedUrl = '';
      let requestedHeaders: Record<string, string> = {};

      global.fetch = jest.fn().mockImplementation((url: string, init: RequestInit) => {
        requestedUrl = url;
        requestedHeaders = (init.headers as Record<string, string>) || {};
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              orders: [
                {
                  id: 'ord-1',
                  order_number: 'LND-001',
                  customer_name: 'Budi',
                  status: 'washing',
                  grand_total: 50000,
                  payment_status: 'unpaid',
                  created_at: new Date().toISOString(),
                },
              ],
              pagination: {
                current_page: 2,
                per_page: 10,
                total: 25,
                total_pages: 3,
                has_more: true,
              },
            },
          }),
        });
      });

      try {
        const res = await laundryClient.getOrders(tenantId, branchId, {
          page: 2,
          perPage: 10,
          search: 'Budi',
          status: 'washing',
        });

        expect(requestedUrl).toContain('page=2');
        expect(requestedUrl).toContain('per_page=10');
        expect(requestedUrl).toContain('search=Budi');
        expect(requestedUrl).toContain('status=washing');
        expect(requestedHeaders['X-Branch-Id']).toBe(branchId);
        expect(requestedHeaders['Authorization']).toBe(`Bearer ${mockToken}`);

        expect(res.orders.length).toBe(1);
        expect(res.pagination.current_page).toBe(2);
        expect(res.pagination.total_pages).toBe(3);
        expect(res.pagination.has_more).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('synthetic adapter correctly paginates and filters laundry orders', async () => {
      const page1 = await syntheticLaundryAdapter.getOrders({ page: 1, perPage: 1 });
      expect(page1.orders.length).toBe(1);
      expect(page1.pagination.current_page).toBe(1);
      expect(page1.pagination.per_page).toBe(1);

      const filterStatus = await syntheticLaundryAdapter.getOrders({ status: 'ready' });
      filterStatus.orders.forEach((o) => {
        expect(o.status).toBe('ready');
      });
    });
  });

  describe('POS Pagination & Filtering', () => {
    it('formats query string correctly for pos orders search and status', async () => {
      const originalFetch = global.fetch;
      let requestedUrl = '';

      global.fetch = jest.fn().mockImplementation((url: string) => {
        requestedUrl = url;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              orders: [],
              pagination: {
                current_page: 1,
                per_page: 20,
                total: 0,
                total_pages: 1,
                has_more: false,
              },
            },
          }),
        });
      });

      try {
        const res = await posClient.getOrders(tenantId, branchId, {
          page: 1,
          perPage: 20,
          search: 'POS-2026',
          status: 'completed',
        });

        expect(requestedUrl).toContain('page=1');
        expect(requestedUrl).toContain('per_page=20');
        expect(requestedUrl).toContain('search=POS-2026');
        expect(requestedUrl).toContain('status=completed');
        expect(res.orders).toEqual([]);
        expect(res.pagination.total).toBe(0);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('synthetic pos adapter supports in-memory search and status filtering', async () => {
      const allRes = await syntheticPosAdapter.getOrders({ page: 1, perPage: 10 });
      expect(allRes.orders.length).toBeGreaterThanOrEqual(1);

      const searchRes = await syntheticPosAdapter.getOrders({ search: 'Walk-in' });
      searchRes.orders.forEach((o) => {
        expect(
          o.order_number.toLowerCase().includes('walk-in') ||
            o.customer_name?.toLowerCase().includes('walk-in')
        ).toBe(true);
      });
    });
  });

  describe('POS Void Order Execution & Idempotency', () => {
    it('sends POST /orders/{id}/void with reason and operation_key idempotency header', async () => {
      const originalFetch = global.fetch;
      let requestedUrl = '';
      let requestedBody: any = null;
      let requestedHeaders: Record<string, string> = {};

      global.fetch = jest.fn().mockImplementation((url: string, init: RequestInit) => {
        requestedUrl = url;
        requestedBody = JSON.parse(init.body as string);
        requestedHeaders = (init.headers as Record<string, string>) || {};

        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              id: 'ord-void-123',
              order_number: 'POS-VOID-01',
              status: 'voided',
              grand_total: 45000,
              payment_amount: 50000,
              change_amount: 5000,
              created_at: new Date().toISOString(),
            },
          }),
        });
      });

      try {
        const opKey = 'b1b5fd00-aaaa-4000-8000-000000000001';
        const res = await posClient.voidOrder(
          tenantId,
          branchId,
          'ord-void-123',
          'Salah input item belanja',
          opKey
        );

        expect(requestedUrl).toContain('/api/v1/mobile/pos/orders/ord-void-123/void');
        expect(requestedBody.reason).toBe('Salah input item belanja');
        expect(requestedBody.operation_key).toBe(opKey);
        expect(requestedHeaders['X-Branch-Id']).toBe(branchId);
        expect(res.status).toBe('voided');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('synthetic adapter handles voidOrder gracefully', async () => {
      const voidResult = await syntheticPosAdapter.voidOrder('ord-999', 'Uji coba pembatalan kasir');
      expect(voidResult.status).toBe('voided');
      expect(voidResult.notes).toContain('Uji coba pembatalan kasir');
    });
  });

  describe('Error Handling & Correlation IDs', () => {
    it('correctly maps 402 subscription_expired with correlation request_id', async () => {
      const originalFetch = global.fetch;
      const expectedReqId = 'req-corr-uuid-402';

      global.fetch = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 402,
          json: async () => ({
            error: {
              code: 'subscription_expired',
              message: 'Masa aktif langganan cabang ini telah berakhir.',
            },
            meta: {
              request_id: expectedReqId,
            },
          }),
        });
      });

      try {
        await expect(
          posClient.getOrders(tenantId, branchId, { page: 1 })
        ).rejects.toMatchObject({
          code: 'subscription_expired',
          status: 402,
          requestId: expectedReqId,
        });
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
