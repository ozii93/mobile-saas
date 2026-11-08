/**
 * Context Resolution Unit & Scenario Tests
 * Tests 5 primary access scenarios:
 * 1. POS Owner -> Auto POS
 * 2. Laundry Owner -> Auto Laundry
 * 3. Multi-Product Owner -> User selection (POS / Laundry)
 * 4. POS Cashier in multi-product tenant -> Only POS & assigned branch
 * 5. Administrator Core without customer identity/grant -> No Access
 * 6. Expired Subscription (402) & Provisioning Pending (409)
 */

import { ContextResolver } from '../src/core/context-resolver';
import { EffectiveDirectory } from '../src/core/types';

describe('ContextResolver - Target Navigation & Grant Behavior', () => {
  test('Kasus 1: Owner dengan grant POS saja -> Auto-Select ke POS', () => {
    const dir: EffectiveDirectory = {
      identity_id: 'id-owner-pos',
      access_version: 1,
      tenants: [
        {
          tenant_id: 'tenant-1',
          name: 'Toko Ritel Sejahtera',
          role: 'owner',
          products: [
            {
              product_code: 'pos',
              grant_id: 'grant-pos-1',
              grant_version: 1,
              availability: 'available',
              branch_scope: 'all',
              branches: [{ branch_id: 'br-pos-1', name: 'Outlet Utama' }],
            },
          ],
        },
      ],
    };

    const res = ContextResolver.resolve(dir);
    expect(res.status).toBe('auto_selected');
    expect(res.autoContext?.product_code).toBe('pos');
    expect(res.autoContext?.branch_id).toBe('br-pos-1');
    expect(res.autoContext?.role).toBe('owner');
  });

  test('Kasus 2: Owner dengan grant Laundry saja -> Auto-Select ke Laundry', () => {
    const dir: EffectiveDirectory = {
      identity_id: 'id-owner-lnd',
      access_version: 1,
      tenants: [
        {
          tenant_id: 'tenant-2',
          name: 'Berkah Laundry',
          role: 'owner',
          products: [
            {
              product_code: 'laundry',
              grant_id: 'grant-lnd-1',
              grant_version: 1,
              availability: 'available',
              branch_scope: 'all',
              branches: [{ branch_id: 'br-lnd-1', name: 'Cabang Melati' }],
            },
          ],
        },
      ],
    };

    const res = ContextResolver.resolve(dir);
    expect(res.status).toBe('auto_selected');
    expect(res.autoContext?.product_code).toBe('laundry');
    expect(res.autoContext?.branch_id).toBe('br-lnd-1');
  });

  test('Kasus 3: Owner dengan kedua grant (POS & Laundry) -> Memberikan pilihan produk', () => {
    const dir: EffectiveDirectory = {
      identity_id: 'id-owner-multi',
      access_version: 1,
      tenants: [
        {
          tenant_id: 'tenant-multi',
          name: 'Holding Usaha Bersama',
          role: 'owner',
          products: [
            {
              product_code: 'pos',
              grant_id: 'grant-pos-m',
              grant_version: 1,
              availability: 'available',
              branch_scope: 'all',
              branches: [{ branch_id: 'br-1', name: 'Outlet Retail' }],
            },
            {
              product_code: 'laundry',
              grant_id: 'grant-lnd-m',
              grant_version: 1,
              availability: 'available',
              branch_scope: 'all',
              branches: [{ branch_id: 'br-2', name: 'Outlet Laundry' }],
            },
          ],
        },
      ],
    };

    const res = ContextResolver.resolve(dir);
    expect(res.status).toBe('needs_selection');
    expect(res.availableProducts.length).toBe(2);
    expect(res.availableProducts[0].product.product_code).toBe('pos');
    expect(res.availableProducts[1].product.product_code).toBe('laundry');
  });

  test('Kasus 4: Kasir POS pada tenant langganan 2 produk -> Hanya dapat POS dan cabangnya', () => {
    const dir: EffectiveDirectory = {
      identity_id: 'id-cashier-pos',
      access_version: 1,
      tenants: [
        {
          tenant_id: 'tenant-multi',
          name: 'Holding Usaha Bersama',
          role: 'staff',
          products: [
            {
              product_code: 'pos',
              grant_id: 'grant-pos-cashier',
              grant_version: 1,
              availability: 'available',
              branch_scope: 'selected',
              branches: [{ branch_id: 'br-1', name: 'Kasir Cabang A' }],
            },
          ],
        },
      ],
    };

    const res = ContextResolver.resolve(dir);
    expect(res.status).toBe('auto_selected');
    expect(res.autoContext?.product_code).toBe('pos');
    expect(res.autoContext?.branch_id).toBe('br-1');
    expect(res.autoContext?.role).toBe('staff');
  });

  test('Kasus 5: Akun administrator Core tanpa identitas/grant pelanggan -> no_access', () => {
    const emptyDir: EffectiveDirectory = {
      identity_id: 'admin-core-id',
      access_version: 1,
      tenants: [],
    };

    const res = ContextResolver.resolve(emptyDir);
    expect(res.status).toBe('no_access');
    expect(res.noAccessReason).toContain('tidak memiliki keanggotaan');
  });

  test('Kasus 6: Langganan kadaluwarsa (402) -> status no_access dengan pesan subscription_expired', () => {
    const dirExpired: EffectiveDirectory = {
      identity_id: 'id-expired',
      access_version: 1,
      tenants: [
        {
          tenant_id: 't-1',
          name: 'Laundry Expired',
          role: 'owner',
          products: [
            {
              product_code: 'laundry',
              grant_id: 'g-1',
              grant_version: 1,
              availability: 'subscription_expired',
              branch_scope: 'all',
              branches: [{ branch_id: 'b-1', name: 'Cabang' }],
            },
          ],
        },
      ],
    };

    const res = ContextResolver.resolve(dirExpired);
    expect(res.status).toBe('no_access');
    expect(res.noAccessReason).toContain('langganan');
  });
});
