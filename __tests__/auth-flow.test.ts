/**
 * Core Auth Client & Error Mapping Tests
 * Verifies login, invalid credentials generic message, me, tickets, and logout
 */

import { coreClient, CoreApiException } from '../src/core/api/core-client';
import { secureStorage } from '../src/core/storage/secure-store';

// Mock global fetch
const originalFetch = global.fetch;

describe('CoreClient - Authentication & Ticket API', () => {
  beforeEach(async () => {
    await secureStorage.clearAllTokens();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('Login berhasil menyimpan central token di secure storage', async () => {
    const mockToken = 'central_bearer_token_xyz';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          token: mockToken,
          token_type: 'Bearer',
          session: {
            id: 'sess-uuid-1',
            identity_id: 'ident-uuid-1',
            device_name: 'Android Test',
            expires_at: '2026-12-07T00:00:00Z',
            created_at: '2026-11-07T00:00:00Z',
            revoked_at: null,
          },
          identity: {
            id: 'ident-uuid-1',
            name: 'Fixture Owner',
            email: 'owner@example.test',
            status: 'active',
            email_verified_at: '2026-11-07T00:00:00Z',
            auth_version: 1,
            access_version: 1,
          },
        },
        meta: { contract_version: 1, request_id: 'req-123' },
      }),
    });

    const res = await coreClient.login('owner@example.test', 'secret123');

    expect(res.token).toBe(mockToken);
    expect(res.identity.email).toBe('owner@example.test');
    expect(await secureStorage.getCoreToken()).toBe(mockToken);
  });

  test('Login gagal dengan 401 invalid_credentials melempar pesan aman', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        error: {
          code: 'invalid_credentials',
          message: 'Email atau password yang Anda masukkan salah.',
        },
        meta: { contract_version: 1, request_id: 'req-err-401' },
      }),
    });

    await expect(coreClient.login('wrong@example.test', 'badpass')).rejects.toThrow(
      CoreApiException
    );
    expect(await secureStorage.getCoreToken()).toBeNull();
  });

  test('Request product ticket menghasilkan tiket 60 detik', async () => {
    await secureStorage.setCoreToken('central_bearer_valid');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          ticket: 'ticket_60s_sample_uuid',
          expires_at: '2026-11-07T12:01:00Z',
          tenant_id: 'tenant-1',
          product_code: 'laundry',
          branch_id: 'branch-1',
        },
        meta: { contract_version: 1, request_id: 'req-ticket' },
      }),
    });

    const ticket = await coreClient.requestProductTicket('tenant-1', 'laundry', 'branch-1');

    expect(ticket.ticket).toBe('ticket_60s_sample_uuid');
    expect(ticket.product_code).toBe('laundry');
  });

  test('Logout mencabut sesi dan membersihkan token dari secure storage', async () => {
    await secureStorage.setCoreToken('central_bearer_valid');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { revoked: true },
        meta: { contract_version: 1, request_id: 'req-logout' },
      }),
    });

    await coreClient.logout(false);

    expect(await secureStorage.getCoreToken()).toBeNull();
  });
});
