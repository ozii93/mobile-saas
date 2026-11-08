/**
 * Context Resolver
 * Evaluates EffectiveDirectory from Core Platform and decides navigation:
 * - Single valid option -> Auto-select
 * - Multiple products/branches -> User selection
 * - Zero valid options -> No access state
 */

import { ActiveContext, EffectiveDirectory, EffectiveProduct, EffectiveTenant } from './types';

export interface ResolutionResult {
  status: 'auto_selected' | 'needs_selection' | 'no_access';
  autoContext?: ActiveContext;
  availableTenants: EffectiveTenant[];
  availableProducts: Array<{
    tenant: EffectiveTenant;
    product: EffectiveProduct;
  }>;
  noAccessReason?: string;
}

export class ContextResolver {
  public static resolve(directory: EffectiveDirectory | null): ResolutionResult {
    if (!directory || !directory.tenants || directory.tenants.length === 0) {
      return {
        status: 'no_access',
        availableTenants: [],
        availableProducts: [],
        noAccessReason: 'Akun Anda tidak memiliki keanggotaan bisnis atau izin produk aktif.',
      };
    }

    const availableProducts: Array<{
      tenant: EffectiveTenant;
      product: EffectiveProduct;
    }> = [];

    for (const tenant of directory.tenants) {
      for (const product of tenant.products) {
        if (product.availability === 'available' && product.branches && product.branches.length > 0) {
          availableProducts.push({ tenant, product });
        }
      }
    }

    if (availableProducts.length === 0) {
      // Periksa apakah ada produk berstatus subscription_expired atau provisioning_pending
      let reason = 'Tidak ada produk atau cabang yang tersedia untuk operasional.';
      for (const tenant of directory.tenants) {
        for (const product of tenant.products) {
          if (product.availability === 'subscription_expired') {
            reason = 'Masa aktif langganan produk Anda telah berakhir. Hubungi pemilik usaha atau pengelola.';
            break;
          } else if (product.availability === 'provisioning_pending') {
            reason = 'Layanan produk sedang dalam proses persiapan (provisioning pending).';
            break;
          }
        }
      }

      return {
        status: 'no_access',
        availableTenants: directory.tenants,
        availableProducts: [],
        noAccessReason: reason,
      };
    }

    // Kasus 1: Tepat 1 tenant, 1 produk, dan 1 cabang yang diizinkan -> Auto-Select
    if (availableProducts.length === 1 && availableProducts[0].product.branches.length === 1) {
      const item = availableProducts[0];
      const branch = item.product.branches[0];

      return {
        status: 'auto_selected',
        autoContext: {
          tenant_id: item.tenant.tenant_id,
          tenant_name: item.tenant.name,
          product_code: item.product.product_code,
          branch_id: branch.branch_id,
          branch_name: branch.name,
          role: item.tenant.role,
        },
        availableTenants: directory.tenants,
        availableProducts,
      };
    }

    // Kasus 2: Ada beberapa pilihan (misal: Owner punya POS dan Laundry, atau beberapa cabang)
    return {
      status: 'needs_selection',
      availableTenants: directory.tenants,
      availableProducts,
    };
  }
}
