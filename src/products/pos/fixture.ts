/**
 * [FIXTURE SYNTHETIC] POS Adapter & Synthetic Data
 * Aligned with pos-mobile-v1.fixture.json
 * Used for offline simulation, unit testing, and sandbox verification
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

export class SyntheticPosAdapter {
  public isSynthetic = true;

  public async exchangeTicket(
    tenantId: string,
    branchId: string,
    _ticket: string,
    _operationKey: string
  ): Promise<PosExchangeResponse> {
    const bearer = `7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069_${Date.now()}`;
    await secureStorage.setProductToken('pos', tenantId, branchId, bearer);

    return {
      token: bearer,
      token_type: 'Bearer',
      expires_at: '2026-11-07T23:59:59Z',
      context: await this.getContext(tenantId, branchId),
    };
  }

  public async getContext(tenantId: string, branchId: string): Promise<PosContextData> {
    return {
      identity_id: '01a1985a-0000-7000-8000-000000000001',
      user_id: '01a19b4e-0000-7000-8000-000000000001',
      user_name: '[FIXTURE SYNTHETIC] Budi Santoso',
      tenant_id: tenantId || '01a1985a-933b-707e-9771-159c6aa5e896',
      tenant_name: 'PT Sumber Rezeki Retailindo',
      branch_id: branchId || '01a1985a-933c-707e-9771-159c6aa5e897',
      branch_name: 'Cabang Bendungan Hilir',
      product_code: 'pos',
      role: 'owner',
      permissions: [
        'pos.orders.read',
        'pos.orders.create',
        'pos.orders.void',
        'pos.catalog.read',
        'pos.shifts.manage',
        'pos.reports.read',
        'pos.staff.manage',
      ],
      entrypoint: 'pos_terminal',
      expires_at: '2026-11-07T23:59:59Z',
    };
  }

  public async getCategories(): Promise<PosCategoryItem[]> {
    return [
      { id: 'cat-0001-0000-0000-0000-000000000001', name: 'Minuman & Kopi', color: '#10B981' },
      { id: 'cat-0002-0000-0000-0000-000000000001', name: 'Makanan & Snack', color: '#F59E0B' },
      { id: 'cat-0003-0000-0000-0000-000000000001', name: 'Kebutuhan Harian', color: '#3B82F6' },
    ];
  }

  public async getProducts(): Promise<PosProductItem[]> {
    return [
      {
        id: 'prod-0001-0000-0000-0000-000000000001',
        name: 'Kopi Susu Gula Aren',
        sku: 'KOP-001',
        barcode: '8991234567890',
        selling_price: 18000,
        cost_price: 8000,
        unit: 'cup',
        track_stock: true,
        current_stock: 50,
        category: {
          id: 'cat-0001-0000-0000-0000-000000000001',
          name: 'Minuman & Kopi',
          color: '#10B981',
        },
        image_url: null,
      },
      {
        id: 'prod-0002-0000-0000-0000-000000000001',
        name: 'Roti Bakar Coklat Keju',
        sku: 'ROTI-001',
        barcode: '8991234567891',
        selling_price: 22000,
        cost_price: 10000,
        unit: 'porsi',
        track_stock: true,
        current_stock: 25,
        category: {
          id: 'cat-0002-0000-0000-0000-000000000001',
          name: 'Makanan & Snack',
          color: '#F59E0B',
        },
        image_url: null,
      },
      {
        id: 'prod-0003-0000-0000-0000-000000000001',
        name: 'Air Mineral 600ml',
        sku: 'AIR-001',
        barcode: '8991234567892',
        selling_price: 5000,
        cost_price: 2500,
        unit: 'botol',
        track_stock: true,
        current_stock: 120,
        category: {
          id: 'cat-0001-0000-0000-0000-000000000001',
          name: 'Minuman & Kopi',
          color: '#10B981',
        },
        image_url: null,
      },
      {
        id: 'prod-0004-0000-0000-0000-000000000001',
        name: 'Kentang Goreng French Fries',
        sku: 'SNK-001',
        barcode: '8991234567893',
        selling_price: 15000,
        cost_price: 7000,
        unit: 'porsi',
        track_stock: true,
        current_stock: 35,
        category: {
          id: 'cat-0002-0000-0000-0000-000000000001',
          name: 'Makanan & Snack',
          color: '#F59E0B',
        },
        image_url: null,
      },
    ];
  }

  public async checkout(
    _tenantId: string,
    _branchId: string,
    payload: PosCheckoutPayload
  ): Promise<PosOrderItem> {
    const products = await this.getProducts();
    let subtotal = 0;

    const lineItems = payload.items.map((it) => {
      const prod = products.find((p) => p.id === it.product_id) || {
        id: it.product_id,
        name: 'Produk POS',
        sku: 'UNKNOWN',
        selling_price: it.unit_price,
      };
      const lineSub = it.quantity * it.unit_price;
      subtotal += lineSub;

      return {
        id: 'item-' + Math.random().toString(36).substring(2, 9),
        product_id: it.product_id,
        product_name: prod.name,
        product_sku: prod.sku,
        quantity: it.quantity,
        unit_price: it.unit_price,
        subtotal: lineSub,
        notes: it.notes,
      };
    });

    const grandTotal = Math.max(0, subtotal - (payload.discount_amount || 0));
    const cashPaid = payload.payment_amount || grandTotal;
    const change = Math.max(0, cashPaid - grandTotal);

    return {
      id: 'ord-pos-' + Date.now(),
      order_number: 'POS-' + Math.floor(10000 + Math.random() * 90000),
      status: 'completed',
      payment_method: payload.payment_method,
      payment_status: 'paid',
      subtotal,
      discount_amount: payload.discount_amount || 0,
      tax_amount: 0,
      service_charge_amount: 0,
      grand_total: grandTotal,
      payment_amount: cashPaid,
      change_amount: change,
      customer_name: payload.customer_name || 'Pelanggan Walk-in',
      table_number: payload.table_number || null,
      notes: payload.notes || null,
      cashier_name: 'Budi Santoso',
      created_at: new Date().toISOString(),
      items: lineItems,
    };
  }

  public async getOrders(
    options: { page?: number; perPage?: number; search?: string; status?: string } = {}
  ): Promise<PosOrdersResponse> {
    const raw: PosOrderItem[] = [
      {
        id: 'ord-sample-01',
        order_number: 'POS-20261107-001',
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
        notes: null,
        cashier_name: 'Budi Santoso',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'ord-sample-02',
        order_number: 'POS-20261107-002',
        status: 'completed',
        payment_method: 'qris',
        payment_status: 'paid',
        subtotal: 54000,
        discount_amount: 0,
        tax_amount: 0,
        service_charge_amount: 0,
        grand_total: 54000,
        payment_amount: 54000,
        change_amount: 0,
        customer_name: 'Ibu Anita',
        table_number: null,
        notes: null,
        cashier_name: 'Budi Santoso',
        created_at: new Date(Date.now() - 1800000).toISOString(),
      },
    ];

    let filtered = raw;
    if (options.status && options.status !== 'all') {
      filtered = filtered.filter((o) => o.status === options.status);
    }
    if (options.search) {
      const q = options.search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          (o.customer_name && o.customer_name.toLowerCase().includes(q))
      );
    }

    const page = options.page || 1;
    const perPage = options.perPage || 10;
    const total = filtered.length;
    const totalPages = Math.ceil(total / perPage) || 1;
    const start = (page - 1) * perPage;
    const paginated = filtered.slice(start, start + perPage);

    return {
      orders: paginated,
      pagination: {
        current_page: page,
        per_page: perPage,
        total,
        total_pages: totalPages,
        has_more: page < totalPages,
      },
    };
  }

  public async getCurrentShift(): Promise<PosShiftItem> {
    return {
      id: 'shift-0001-0000-0000-0000-000000000001',
      status: 'open',
      starting_cash: 200000,
      opened_at: new Date(Date.now() - 5 * 3600000).toISOString(),
      notes: 'Shift Pagi',
      total_sales: 420000,
      transactions_count: 8,
    };
  }

  public async voidOrder(orderId: string, reason: string): Promise<PosOrderItem> {
    return {
      id: orderId,
      order_number: 'POS-VOIDED',
      status: 'voided',
      payment_method: 'cash',
      payment_status: 'refunded',
      subtotal: 0,
      discount_amount: 0,
      tax_amount: 0,
      service_charge_amount: 0,
      grand_total: 0,
      payment_amount: 0,
      change_amount: 0,
      customer_name: 'Pelanggan',
      table_number: null,
      notes: `Dibatalkan (Void): ${reason}`,
      cashier_name: 'Budi Santoso',
      created_at: new Date().toISOString(),
    };
  }

  public async logout(tenantId: string, branchId: string): Promise<void> {
    await secureStorage.removeProductToken('pos', tenantId, branchId);
  }
}

export const syntheticPosAdapter = new SyntheticPosAdapter();
