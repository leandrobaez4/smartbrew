import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { waitForInstagramContainer } from './instagram-container';
import { requestMeta } from './meta-api';
vi.mock('./meta-api', () => ({ requestMeta: vi.fn() }));
const meta = vi.mocked(requestMeta);
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());
const wait = () => waitForInstagramContainer('https://graph.instagram.com/v26.0', 'test-token', '111');
it('waits on the same container until FINISHED', async () => {
  meta.mockResolvedValueOnce({ status_code: 'IN_PROGRESS' }).mockResolvedValueOnce({ status_code: 'FINISHED' });
  const result = wait();
  await vi.advanceTimersByTimeAsync(2000);
  await result;
  expect(meta).toHaveBeenCalledTimes(2);
  for (const call of meta.mock.calls) {
    expect(call[1]).toBe('https://graph.instagram.com/v26.0/111?fields=status_code,status');
    expect(call[2]).toMatchObject({ cache: 'no-store', headers: { Authorization: 'Bearer test-token' } });
    expect(call[2].signal).toBeDefined();
  }
});
it('limits processing wait to twenty seconds', async () => {
  meta.mockResolvedValue({ status_code: 'IN_PROGRESS' });
  const result = expect(wait()).rejects.toMatchObject({ pending: true });
  await vi.advanceTimersByTimeAsync(20_000);
  await result;
  expect(meta).toHaveBeenCalledTimes(10);
});
it.each(['ERROR', 'EXPIRED'])('fails safely on %s', async status_code => {
  meta.mockResolvedValue({ status_code });
  await expect(wait()).rejects.toMatchObject({ pending: false });
  expect(meta).toHaveBeenCalledTimes(1);
});
it.each(['PUBLISHED', 'UNKNOWN', undefined])('blocks unexpected status %s', async status_code => {
  meta.mockResolvedValue({ status_code });
  await expect(wait()).rejects.toMatchObject({ pending: true });
});
it('preserves the attempt on lookup failure', async () => {
  meta.mockRejectedValue(Error('timeout'));
  await expect(wait()).rejects.toMatchObject({ pending: true });
  expect(meta).toHaveBeenCalledTimes(1);
});
