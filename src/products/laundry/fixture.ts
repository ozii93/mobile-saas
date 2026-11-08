/**
 * [FIXTURE SYNTHETIC] Laundry Adapter & Synthetic Data
 * Explicitly labeled for offline simulation, unit testing, and sandbox verification
 * Does NOT claim to be live backend integration
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

export class SyntheticLaundryAdapter {
  public isSynthetic = true;

  public async exchangeTicket(
    tenantId: string,
    branchId: string,
    _ticket: string,
    _operationKey: string
  ): Promise<LaundryExchangeResponse> {
    return {
      token: `synthetic_laundry_bearer_${tenantId}_${branchId}_${Date.now()}`,
      token_type: 'Bearer',
      expires_at: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      context: await this.getContext(tenantId, branchId),
    };
  }

  public async getContext(tenantId: string, branchId: string): Promise<LaundryContextData> {
    return {
      identity_id: '11111111-1111-4111-8111-111111111111',
      product_code: 'laundry',
      tenant: {
        id: tenantId,
        code: 'TENANT-LAUNDRY-SYNTH',
        name: '[FIXTURE SYNTHETIC] Laundry Berkah',
      },
      branch: {
        id: branchId,
        code: 'CAB-LND-01',
        name: '[FIXTURE SYNTHETIC] Cabang Pusat',
      },
      user: {
        id: 'user-synth-laundry-1',
        name: '[FIXTURE SYNTHETIC] Operator Laundry',
        role: 'staff',
        role_label: 'Operator / Kasir Laundry',
      },
      permissions: ['orders.read', 'orders.create', 'orders.status', 'payments.create', 'deliveries.manage'],
      entrypoints: ['orders', 'deliveries', 'cashier', 'customers'],
      expires_at: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    };
  }

  public async getOrders(
    options: { page?: number; perPage?: number; search?: string; status?: string } = {}
  ): Promise<LaundryOrdersResponse> {
    const raw: LaundryOrder[] = [
      {
        id: 'ord-synth-101',
        order_number: 'LND-20261107-001',
        customer_name: '[FIXTURE] Budi Santoso',
        customer_phone: '081234567890',
        status: 'received',
        status_label: 'Diterima',
        payment_status: 'unpaid',
        total_amount: 45000,
        paid_amount: 0,
        remaining_amount: 45000,
        items_count: 2,
        created_at: new Date().toISOString(),
      },
      {
        id: 'ord-synth-102',
        order_number: 'LND-20261107-002',
        customer_name: '[FIXTURE] Siti Aminah',
        customer_phone: '081987654321',
        status: 'washing',
        status_label: 'Proses Cuci',
        payment_status: 'paid',
        total_amount: 72000,
        paid_amount: 72000,
        remaining_amount: 0,
        items_count: 3,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'ord-synth-103',
        order_number: 'LND-20261107-003',
        customer_name: '[FIXTURE] Hendra Wijaya',
        customer_phone: '081345678901',
        status: 'ready_for_pickup',
        status_label: 'Siap Diambil',
        payment_status: 'partial',
        total_amount: 90000,
        paid_amount: 50000,
        remaining_amount: 40000,
        items_count: 4,
        created_at: new Date(Date.now() - 7200000).toISOString(),
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

  public async getServices(): Promise<LaundryServiceItem[]> {
    return [
      { id: 'srv-1', name: '[FIXTURE] Cuci Komplit Reguler (2 Hari)', unit: 'kg', price: 7000, duration_hours: 48 },
      { id: 'srv-2', name: '[FIXTURE] Cuci Komplit Kilat (1 Hari)', unit: 'kg', price: 12000, duration_hours: 24 },
      { id: 'srv-3', name: '[FIXTURE] Cuci Kering Setrika Satuan - Kemeja', unit: 'pcs', price: 8000 },
      { id: 'srv-4', name: '[FIXTURE] Cuci Bed Cover Besar', unit: 'pcs', price: 35000 },
    ];
  }

  public async getDeliveries(): Promise<LaundryDeliveryTask[]> {
    return [
      {
        id: 'del-1',
        order_id: 'ord-synth-101',
        order_number: 'LND-20261107-001',
        type: 'pickup',
        customer_name: '[FIXTURE] Budi Santoso',
        customer_phone: '081234567890',
        address: 'Jl. Melati No. 12, Kebayoran Baru',
        status: 'assigned',
        notes: 'Pakaian kotor di teras depan',
      },
    ];
  }

  public async getCashierShift(): Promise<LaundryCashierShift> {
    return {
      shift_id: 'shift-synth-01',
      cashier_name: '[FIXTURE] Operator Kasir',
      started_at: new Date(Date.now() - 4 * 3600000).toISOString(),
      initial_cash: 200000,
      total_cash_received: 420000,
      orders_processed: 6,
    };
  }
}

export const syntheticLaundryAdapter = new SyntheticLaundryAdapter();
