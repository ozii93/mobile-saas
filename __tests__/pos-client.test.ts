/**
 * POS Client & Contract Tests
 * Aligned with OpenAPI 3.1 pos-mobile-v1.openapi.json & pos-mobile-v1.fixture.json
 */

import { posClient } from '../src/products/pos/client';
import { secureStorage } from '../src/core/storage/secure-store';

const originalFetch = global.fetch;

describe('PosClient - Contract & API Operations', () => {
  beforeEach(async () => {
    await secureStorage.clearAllTokens();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('Exchange tiket menghasilkan token POS dan menyimpannya di secure storage terisolasi', async () => {
    const mockToken = '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          token: mockToken,
          token_type: 'Bearer',
          expires_at: '2026-11-07T23:59:59Z',
          context: {
            identity_id: '01a1985a-0000-7000-8000-000000000001',
            user_id: '01a19b4e-0000-7000-8000-000000000001',
            user_name: 'Budi Santoso',
            tenant_id: '01a1985a-933b-707e-9771-159c6aa5e896',
            tenant_name: 'PT Sumber Rezeki Retailindo',
            branch_id: '01a1985a-933c-707e-9771-159c6aa5e897',
            branch_name: 'Cabang Bendungan Hilir',
            product_code: 'pos',
            role: 'owner',
            permissions: ['pos.orders.read', 'pos.orders.create'],
            entrypoint: 'pos_terminal',
          },
        },
        meta: { contract_version: 1, request_id: 'req-pos-ex' },
      }),
    });

    const res = await posClient.exchangeTicket(
      '01a1985a-933b-707e-9771-159c6aa5e896',
      '01a1985a-933c-707e-9771-159c6aa5e897',
      'tkt_valid_60s',
      'c1a10001-0000-0000-0000-000000000001'
    );

    expect(res.token).toBe(mockToken);
    expect(res.context.user_name).toBe('Budi Santoso');
    expect(await secureStorage.getProductToken('pos', '01a1985a-933b-707e-9771-159c6aa5e896', '01a1985a-933c-707e-9771-159c6aa5e897')).toBe(mockToken);
  });

  test('Ambil katalog produk POS dengan Bearer token produk', async () => {
    await secureStorage.setProductToken(
      'pos',
      'tenant-pos-1',
      'branch-pos-1',
      'pos_bearer_token_xyz'
    );

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'prod-0001',
            name: 'Kopi Susu Gula Aren',
            sku: 'KOP-001',
            barcode: '8991234567890',
            selling_price: 18000,
            cost_price: 8000,
            unit: 'cup',
            track_stock: true,
            current_stock: 50,
            category: { id: 'cat-1', name: 'Minuman & Kopi', color: '#10B981' },
            image_url: null,
          },
        ],
      }),
    });

    const products = await posClient.getProducts('tenant-pos-1', 'branch-pos-1');

    expect(products.length).toBe(1);
    expect(products[0].name).toBe('Kopi Susu Gula Aren');
    expect(products[0].selling_price).toBe(18000);
  });

  test('Checkout transaksi kasir mengirimkan payload sesuai OpenAPI', async () => {
    await secureStorage.setProductToken(
      'pos',
      'tenant-pos-1',
      'branch-pos-1',
      'pos_bearer_token_xyz'
    );

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          id: 'ord-pos-new',
          order_number: 'POS-20261107-999',
          status: 'completed',
          payment_method: 'cash',
          payment_status: 'paid',
          subtotal: 36000,
          discount_amount: 0,
          tax_amount: 0,
          service_charge_amount: 0,
          grand_total: 36000,
          payment_amount: 50000,
          change_amount: 14000,
          customer_name: 'Pelanggan Walk-in',
          table_number: '05',
          notes: 'Pesanan meja',
          cashier_name: 'Budi Santoso',
          created_at: '2026-11-07T12:00:00Z',
        },
      }),
    });

    const order = await posClient.checkout('tenant-pos-1', 'branch-pos-1', {
      operation_key: 'c1a10001-0000-0000-0000-000000000002',
      payment_method: 'cash',
      payment_amount: 50000,
      customer_name: 'Pelanggan Walk-in',
      table_number: '05',
      items: [
        {
          product_id: 'prod-0001',
          quantity: 2,
          unit_price: 18000,
          notes: 'Sedikit gula',
        },
      ],
    });

    expect(order.order_number).toBe('POS-20261107-999');
    expect(order.grand_total).toBe(36000);
    expect(order.change_amount).toBe(14000);
  });
});
