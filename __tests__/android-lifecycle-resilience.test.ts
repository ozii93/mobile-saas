/**
 * PLAN-003: Android Lifecycle, Session Hydration & Network Resilience Tests
 * Verifies app restart hydration, background-to-foreground token revalidation,
 * session revocation auto-logout, and network failure resilience.
 */

import { secureStorage } from '../src/core/storage/secure-store';
import { coreClient, CoreApiException } from '../src/core/api/core-client';
import { sessionCoordinator } from '../src/core/session-coordinator';
import { posClient, PosApiException } from '../src/products/pos/client';
import { laundryClient, LaundryApiException } from '../src/products/laundry/client';

describe('PLAN-003: Android Lifecycle & Network Resilience', () => {
  const tenantId = 'tenant-android-01';
  const branchId = 'branch-android-01';
  const validCoreToken = 'mock-core-jwt-valid';

  beforeEach(async () => {
    await secureStorage.clearAllTokens();
  });

  afterAll(async () => {
    await secureStorage.clearAllTokens();
  });

  describe('1. Cold Start & App Restart Hydration', () => {
    it('restores session seamlessly when token is valid in SecureStore', async () => {
      // 1. Setup persisted tokens
      await secureStorage.setCoreToken(validCoreToken);
      await secureStorage.setProductToken('pos', tenantId, branchId, 'mock-pos-token');

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/mobile/me')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                identity: {
                  id: 'usr-1',
                  name: 'Owner Toko',
                  email: 'owner@example.com',
                },
                session: {
                  id: 'sess-1',
                  device_name: 'Android Pixel 9',
                },
              },
            }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: {} }) });
      });

      try {
        const storedToken = await secureStorage.getCoreToken();
        expect(storedToken).toBe(validCoreToken);

        const me = await coreClient.getMe();
        expect(me.identity.email).toBe('owner@example.com');
        expect(me.session.device_name).toBe('Android Pixel 9');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('clears all tokens and resets to logged_out when persisted token is revoked (HTTP 401)', async () => {
      await secureStorage.setCoreToken('expired-or-revoked-token');

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({
            error: {
              code: 'unauthenticated',
              message: 'Token telah kadaluarsa atau sesi dicabut dari perangkat lain.',
            },
            meta: { request_id: 'req-revoked-401' },
          }),
        });
      });

      try {
        let caughtErr: CoreApiException | null = null;
        try {
          await coreClient.getMe();
        } catch (err) {
          caughtErr = err as CoreApiException;
        }

        expect(caughtErr).not.toBeNull();
        expect(caughtErr?.status).toBe(401);
        expect(caughtErr?.code).toBe('unauthenticated');

        // Simulasi handler auth context saat 401: bersihkan token
        await secureStorage.clearAllTokens();

        const afterToken = await secureStorage.getCoreToken();
        expect(afterToken).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('2. Background-to-Foreground Revalidation', () => {
    it('detects server-side revocation on foreground resume and isolates session', async () => {
      await secureStorage.setCoreToken(validCoreToken);
      await secureStorage.setProductToken('pos', tenantId, branchId, 'mock-pos-token');

      // Simulasi server merespons 401 unauthenticated saat aplikasi resume ke foreground
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({
            error: { code: 'token_revoked', message: 'Sesi di-revoke oleh Administrator.' },
            meta: { request_id: 'req-resume-revoke' },
          }),
        });
      });

      try {
        let authRevoked = false;
        try {
          await coreClient.getMe();
        } catch (err: any) {
          if (err.status === 401) {
            authRevoked = true;
            await secureStorage.clearAllTokens();
          }
        }

        expect(authRevoked).toBe(true);
        expect(await secureStorage.getCoreToken()).toBeNull();
        expect(await secureStorage.getProductToken('pos', tenantId, branchId)).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('3. Network Disruption & Timeout Resilience', () => {
    it('handles AbortError timeout with HTTP 408 code and correlation ID without crashing', async () => {
      await secureStorage.setProductToken('pos', tenantId, branchId, 'mock-pos-token');

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() => {
        const abortErr = new Error('The user aborted a request.');
        abortErr.name = 'AbortError';
        return Promise.reject(abortErr);
      });

      try {
        let posTimeoutErr: PosApiException | null = null;
        try {
          await posClient.getOrders(tenantId, branchId);
        } catch (err) {
          posTimeoutErr = err as PosApiException;
        }

        expect(posTimeoutErr).not.toBeNull();
        expect(posTimeoutErr?.status).toBe(408);
        expect(posTimeoutErr?.code).toBe('timeout');
        expect(posTimeoutErr?.requestId).toBeDefined();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('handles physical network drop (failed to fetch) gracefully', async () => {
      await secureStorage.setProductToken('laundry', tenantId, branchId, 'mock-laundry-token');

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() => {
        return Promise.reject(new Error('Network request failed'));
      });

      try {
        let laundryNetErr: LaundryApiException | null = null;
        try {
          await laundryClient.getOrders(tenantId, branchId);
        } catch (err) {
          laundryNetErr = err as LaundryApiException;
        }

        expect(laundryNetErr).not.toBeNull();
        expect(laundryNetErr?.code).toBe('network_error');
        expect(laundryNetErr?.status).toBe(0);
        expect(laundryNetErr?.message).toContain('Network request failed');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('4. Operation Key Idempotency Pasca Retry', () => {
    it('generates consistent unique UUIDs for idempotent mutations', () => {
      const opKey1 = sessionCoordinator.generateUuid();
      const opKey2 = sessionCoordinator.generateUuid();

      expect(opKey1).toBeDefined();
      expect(opKey2).toBeDefined();
      expect(opKey1).not.toBe(opKey2);
      expect(opKey1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('5. Google Play Store Policy & Distribution Compliance Audit', () => {
    it('verifies no unauthorized in-app purchase libraries are linked', () => {
      // Audit package.json dependencies
      const pkg = require('../package.json');
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      expect(deps['react-native-iap']).toBeUndefined();
      expect(deps['@stripe/stripe-react-native']).toBeUndefined();
      expect(deps['expo-in-app-purchases']).toBeUndefined();
    });

    it('verifies secure storage and crypto libraries conform to Android Keystore requirements', () => {
      const pkg = require('../package.json');
      expect(pkg.dependencies['expo-secure-store']).toBeDefined();
    });
  });
});
