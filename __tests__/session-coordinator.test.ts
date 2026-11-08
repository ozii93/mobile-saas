/**
 * Session Coordinator Unit & Concurrency Tests
 * Tests single-flight exchange, idempotency, anti-replay, and generation guard
 */

import { sessionCoordinator } from '../src/core/session-coordinator';
import { ActiveContext } from '../src/core/types';

describe('SessionCoordinator - Single Flight & Idempotency', () => {
  const mockContext: ActiveContext = {
    tenant_id: 'tenant-test-uuid',
    tenant_name: 'Test Tenant',
    product_code: 'pos',
    branch_id: 'branch-test-uuid',
    branch_name: 'Cabang Test',
    role: 'owner',
  };

  test('Single-flight: Permintaan exchange ganda yang paralel digabungkan menjadi satu proses', async () => {
    // Jalankan dua pemanggilan secara paralel untuk konteks yang sama
    const call1 = sessionCoordinator.exchangeProductSession(mockContext, { preferSynthetic: true });
    const call2 = sessionCoordinator.exchangeProductSession(mockContext, { preferSynthetic: true });

    const [res1, res2] = await Promise.all([call1, call2]);

    expect(res1.token).toBe(res2.token);
    expect(res1.isSynthetic).toBe(true);
    expect(res1.product_code).toBe('pos');
  });

  test('Context generation guard membatalkan respon konteks lama', async () => {
    const { generationId } = sessionCoordinator.advanceGeneration();

    expect(sessionCoordinator.isCurrentGeneration(generationId)).toBe(true);

    // Beralih ke generasi baru
    sessionCoordinator.advanceGeneration();

    // Generasi sebelumnya kini usang
    expect(sessionCoordinator.isCurrentGeneration(generationId)).toBe(false);
  });

  test('Pertukaran POS menghasilkan sesi berlabel [FIXTURE SYNTHETIC]', async () => {
    const session = await sessionCoordinator.exchangeProductSession(mockContext, { preferSynthetic: true });

    expect(session.isSynthetic).toBe(true);
    expect(session.product_code).toBe('pos');
    expect(session.user.name).toContain('[FIXTURE SYNTHETIC]');
  });
});
