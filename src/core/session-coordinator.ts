/**
 * Session Coordinator
 * Manages single-flight ticket exchange, idempotent recovery, context generation guard,
 * token isolation, and context switching across Core, Laundry, and POS.
 */

import { coreClient } from './api/core-client';
import { secureStorage } from './storage/secure-store';
import { ActiveContext } from './types';
import { laundryClient } from '../products/laundry/client';
import { syntheticLaundryAdapter } from '../products/laundry/fixture';
import { posClient } from '../products/pos/client';
import { syntheticPosAdapter } from '../products/pos/fixture';

export interface ProductSessionContext {
  product_code: string;
  tenant_id: string;
  branch_id: string;
  token: string;
  expires_at: string;
  user: {
    id: string | number;
    name: string;
    role: string;
  };
  permissions: string[];
  entrypoints: string[];
  isSynthetic?: boolean;
}

export class SessionCoordinator {
  private inFlightExchanges: Map<string, Promise<ProductSessionContext>> = new Map();
  private pendingOperationKeys: Map<string, string> = new Map();
  private currentGenerationId = 0;
  private currentAbortController: AbortController | null = null;

  public generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  public getContextKey(tenantId: string, productCode: string, branchId: string): string {
    return `${tenantId}:${productCode.toLowerCase()}:${branchId}`;
  }

  /**
   * Mengawali generasi konteks baru.
   * Membatalkan request konteks lama via AbortController.
   */
  public advanceGeneration(): { generationId: number; signal: AbortSignal } {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.currentGenerationId++;
    this.currentAbortController = new AbortController();
    return {
      generationId: this.currentGenerationId,
      signal: this.currentAbortController.signal,
    };
  }

  public isCurrentGeneration(generationId: number): boolean {
    return generationId === this.currentGenerationId;
  }

  /**
   * Single-flight idempotent exchange:
   * 1. Mencegah request exchange paralel untuk konteks yang sama
   * 2. Meminta tiket 60 detik dari Core
   * 3. Menukarkan ke backend produk dengan operation_key UUID
   * 4. Memuat context produk sebelum halaman operasional dibuka
   */
  public async exchangeProductSession(
    context: ActiveContext,
    options: {
      generationId?: number;
      preferSynthetic?: boolean;
      deviceName?: string;
    } = {}
  ): Promise<ProductSessionContext> {
    const key = this.getContextKey(context.tenant_id, context.product_code, context.branch_id);

    // Single flight check: join existing in-flight exchange if one is already running
    const existingPromise = this.inFlightExchanges.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    const exchangePromise = this.executeExchange(context, key, options);
    this.inFlightExchanges.set(key, exchangePromise);

    try {
      return await exchangePromise;
    } finally {
      this.inFlightExchanges.delete(key);
    }
  }

  private async executeExchange(
    context: ActiveContext,
    key: string,
    options: {
      generationId?: number;
      preferSynthetic?: boolean;
      deviceName?: string;
    }
  ): Promise<ProductSessionContext> {
    // Siapkan atau gunakan operation_key yang belum selesai (Idempotent attempt tracking)
    let operationKey = this.pendingOperationKeys.get(key);
    if (!operationKey) {
      operationKey = this.generateUuid();
      this.pendingOperationKeys.set(key, operationKey);
    }

    const generationId = options.generationId ?? this.currentGenerationId;
    const deviceName = options.deviceName ?? 'Multiple-SaaS Mobile App';

    // 1. Dapatkan tiket 60 detik dari Core Platform
    let ticketData;
    try {
      ticketData = await coreClient.requestProductTicket(
        context.tenant_id,
        context.product_code,
        context.branch_id
      );
    } catch (coreErr) {
      // Jika offline dan preferSynthetic diaktifkan (misal pada sandbox / test mode)
      if (options.preferSynthetic) {
        return this.exchangeViaSynthetic(context);
      }
      throw coreErr;
    }

    // Periksa apakah context generation telah berpindah
    if (!this.isCurrentGeneration(generationId)) {
      throw new Error('Context generation obsolete. Request cancelled.');
    }

    // 2. Kirim tiket ke backend produk tujuan
    if (context.product_code.toLowerCase() === 'laundry') {
      try {
        const exchangeRes = await laundryClient.exchangeTicket(
          context.tenant_id,
          context.branch_id,
          ticketData.ticket,
          operationKey,
          deviceName
        );

        // Sukses: bersihkan operation_key yang tertahan
        this.pendingOperationKeys.delete(key);

        return {
          product_code: 'laundry',
          tenant_id: context.tenant_id,
          branch_id: context.branch_id,
          token: exchangeRes.token,
          expires_at: exchangeRes.expires_at,
          user: exchangeRes.context.user,
          permissions: exchangeRes.context.permissions,
          entrypoints: exchangeRes.context.entrypoints,
          isSynthetic: false,
        };
      } catch (laundryErr: unknown) {
        // Jika backend live belum reachable atau fallback diizinkan
        if (options.preferSynthetic) {
          return this.exchangeViaSynthetic(context);
        }
        throw laundryErr;
      }
    } else if (context.product_code.toLowerCase() === 'pos') {
      try {
        const posRes = await posClient.exchangeTicket(
          context.tenant_id,
          context.branch_id,
          ticketData.ticket,
          operationKey
        );

        this.pendingOperationKeys.delete(key);

        return {
          product_code: 'pos',
          tenant_id: context.tenant_id,
          branch_id: context.branch_id,
          token: posRes.token,
          expires_at: posRes.expires_at,
          user: {
            id: posRes.context.user_id,
            name: posRes.context.user_name,
            role: posRes.context.role,
          },
          permissions: posRes.context.permissions,
          entrypoints: [posRes.context.entrypoint],
          isSynthetic: false,
        };
      } catch (posErr: unknown) {
        if (options.preferSynthetic) {
          return this.exchangeViaSynthetic(context);
        }
        throw posErr;
      }
    } else {
      throw new Error(`Produk '${context.product_code}' belum didukung pada aplikasi mobile ini.`);
    }
  }

  private async exchangeViaSynthetic(context: ActiveContext): Promise<ProductSessionContext> {
    const key = this.getContextKey(context.tenant_id, context.product_code, context.branch_id);
    this.pendingOperationKeys.delete(key);

    if (context.product_code.toLowerCase() === 'laundry') {
      const res = await syntheticLaundryAdapter.exchangeTicket(
        context.tenant_id,
        context.branch_id,
        'synthetic-ticket-60s',
        this.generateUuid()
      );
      return {
        product_code: 'laundry',
        tenant_id: context.tenant_id,
        branch_id: context.branch_id,
        token: res.token,
        expires_at: res.expires_at,
        user: res.context.user,
        permissions: res.context.permissions,
        entrypoints: res.context.entrypoints,
        isSynthetic: true,
      };
    } else {
      const res = await syntheticPosAdapter.exchangeTicket(
        context.tenant_id,
        context.branch_id,
        'synthetic-ticket-60s',
        this.generateUuid()
      );
      return {
        product_code: 'pos',
        tenant_id: context.tenant_id,
        branch_id: context.branch_id,
        token: res.token,
        expires_at: res.expires_at,
        user: {
          id: res.context.user_id,
          name: res.context.user_name,
          role: res.context.role,
        },
        permissions: res.context.permissions,
        entrypoints: [res.context.entrypoint],
        isSynthetic: true,
      };
    }
  }

  /**
   * Membersihkan sesi saat switch context atau logout
   */
  public async switchContext(oldContext: ActiveContext | null): Promise<void> {
    this.advanceGeneration();
    if (oldContext) {
      await secureStorage.removeProductToken(
        oldContext.product_code,
        oldContext.tenant_id,
        oldContext.branch_id
      );
    }
    await secureStorage.setActiveContext(null);
  }
}

export const sessionCoordinator = new SessionCoordinator();
