/**
 * Audience Token Isolation & Storage Tests
 * Enforces strict per-audience and per-branch separation
 */

import { secureStorage } from '../src/core/storage/secure-store';

describe('Audience Token & Cache Isolation', () => {
  beforeEach(async () => {
    await secureStorage.clearAllTokens();
  });

  test('Penyimpanan token terisolasi antara Core, POS, dan Laundry', async () => {
    const coreToken = 'core_central_bearer_secret_123';
    const posTokenBranchA = 'pos_bearer_tenant1_branchA_456';
    const posTokenBranchB = 'pos_bearer_tenant1_branchB_789';
    const laundryToken = 'laundry_bearer_tenant1_branchA_999';

    // Set Core Token
    await secureStorage.setCoreToken(coreToken);

    // Set Product Tokens
    await secureStorage.setProductToken('pos', 'tenant1', 'branchA', posTokenBranchA);
    await secureStorage.setProductToken('pos', 'tenant1', 'branchB', posTokenBranchB);
    await secureStorage.setProductToken('laundry', 'tenant1', 'branchA', laundryToken);

    // Verifikasi masing-masing token independen dan tidak saling menimpa
    expect(await secureStorage.getCoreToken()).toBe(coreToken);
    expect(await secureStorage.getProductToken('pos', 'tenant1', 'branchA')).toBe(posTokenBranchA);
    expect(await secureStorage.getProductToken('pos', 'tenant1', 'branchB')).toBe(posTokenBranchB);
    expect(await secureStorage.getProductToken('laundry', 'tenant1', 'branchA')).toBe(laundryToken);

    // Verifikasi token POS tidak dapat diambil sebagai token Laundry
    expect(await secureStorage.getProductToken('laundry', 'tenant1', 'branchB')).toBeNull();
  });

  test('Ganti cabang / switch context menghapus token produk lama tetapi mempertahankan token pusat', async () => {
    const coreToken = 'core_central_token_stay_active';
    await secureStorage.setCoreToken(coreToken);

    await secureStorage.setProductToken('laundry', 'tenant1', 'branch1', 'laundry_token_old');
    expect(await secureStorage.getProductToken('laundry', 'tenant1', 'branch1')).toBe('laundry_token_old');

    // Hapus sesi cabang lama
    await secureStorage.removeProductToken('laundry', 'tenant1', 'branch1');

    // Token cabang lama terhapus
    expect(await secureStorage.getProductToken('laundry', 'tenant1', 'branch1')).toBeNull();

    // Token pusat Core tetap utuh untuk meminta tiket baru
    expect(await secureStorage.getCoreToken()).toBe(coreToken);
  });

  test('Logout perangkat membersihkan seluruh token (Core, POS, Laundry)', async () => {
    await secureStorage.setCoreToken('core_token');
    await secureStorage.setProductToken('pos', 't1', 'b1', 'pos_token');
    await secureStorage.setProductToken('laundry', 't1', 'b1', 'lnd_token');

    await secureStorage.clearAllTokens();

    expect(await secureStorage.getCoreToken()).toBeNull();
    expect(await secureStorage.getProductToken('pos', 't1', 'b1')).toBeNull();
    expect(await secureStorage.getProductToken('laundry', 't1', 'b1')).toBeNull();
  });
});
