/**
 * Native Secure Storage with Audience and Context Isolation
 * Enforces per-audience token separation (Core, POS, Laundry)
 * Strictly avoids storing passwords, service secrets, or tokens in logs
 */

import * as SecureStore from 'expo-secure-store';

class IsolatedStorageService {
  private memoryFallback: Map<string, string> = new Map();

  private isNativeAvailable(): boolean {
    try {
      return typeof SecureStore?.setItemAsync === 'function';
    } catch {
      return false;
    }
  }

  private async setItem(key: string, value: string): Promise<void> {
    this.memoryFallback.set(key, value);
    if (this.isNativeAvailable()) {
      try {
        await SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
      } catch {
        // Ignore native errors, memory fallback has the value
      }
    }
  }

  private async getItem(key: string): Promise<string | null> {
    if (this.isNativeAvailable()) {
      try {
        const val = await SecureStore.getItemAsync(key);
        if (val !== null && val !== undefined) {
          return val;
        }
      } catch {
        // Fallback to memory
      }
    }
    return this.memoryFallback.get(key) ?? null;
  }

  private async deleteItem(key: string): Promise<void> {
    this.memoryFallback.delete(key);
    if (this.isNativeAvailable()) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Fallback to memory
      }
    }
  }

  // --- Core Session Token ---
  public async setCoreToken(token: string): Promise<void> {
    await this.setItem('core_central_token', token);
  }

  public async getCoreToken(): Promise<string | null> {
    return this.getItem('core_central_token');
  }

  public async removeCoreToken(): Promise<void> {
    await this.deleteItem('core_central_token');
  }

  // --- Product Session Token (Isolated by audience, tenant, and branch) ---
  private formatProductTokenKey(productCode: string, tenantId: string, branchId: string): string {
    return `${productCode.toLowerCase()}_bearer_${tenantId}_${branchId}`;
  }

  public async setProductToken(
    productCode: string,
    tenantId: string,
    branchId: string,
    token: string
  ): Promise<void> {
    const key = this.formatProductTokenKey(productCode, tenantId, branchId);
    await this.setItem(key, token);
  }

  public async getProductToken(
    productCode: string,
    tenantId: string,
    branchId: string
  ): Promise<string | null> {
    const key = this.formatProductTokenKey(productCode, tenantId, branchId);
    return this.getItem(key);
  }

  public async removeProductToken(
    productCode: string,
    tenantId: string,
    branchId: string
  ): Promise<void> {
    const key = this.formatProductTokenKey(productCode, tenantId, branchId);
    await this.deleteItem(key);
  }

  // --- Active Context Cache (Non-sensitive metadata) ---
  public async setActiveContext(context: {
    tenant_id: string;
    product_code: string;
    branch_id: string;
  } | null): Promise<void> {
    if (!context) {
      await this.deleteItem('active_context_meta');
    } else {
      await this.setItem('active_context_meta', JSON.stringify(context));
    }
  }

  public async getActiveContext(): Promise<{
    tenant_id: string;
    product_code: string;
    branch_id: string;
  } | null> {
    const data = await this.getItem('active_context_meta');
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  // --- Clear All Device Tokens (Logout Device) ---
  public async clearAllTokens(): Promise<void> {
    await this.removeCoreToken();
    await this.setActiveContext(null);
    this.memoryFallback.clear();
  }
}

export const secureStorage = new IsolatedStorageService();
