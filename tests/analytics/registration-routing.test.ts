import { expect, it } from 'vitest';
import { GET } from '@/app/api/auth/bridge/start/route';
it('opens invite-free registration through the bridge and preserves the Pulse return', async () => {
  const response = await GET(new Request('https://pulse.axxes.app/api/auth/bridge/start?mode=signup', { headers: { host: 'pulse.axxes.app' } }));
  const destination = new URL(response.headers.get('location')!);
  expect(destination.origin).toBe('https://handshake.axxes.club');
  expect(destination.pathname).toBe('/sign-up');
  const callback = new URL(destination.searchParams.get('redirect')!);
  expect(callback.origin).toBe('https://pulse.axxes.club');
  expect(callback.pathname).toBe('/api/auth/bridge/issue');
  expect(callback.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(response.headers.get('set-cookie')).toContain('__Host-pulse_bridge=');
});
it('keeps login on the Pulse bridge and rejects unrelated hosts', async () => {
  const response = await GET(new Request('https://pulse.axxes.app/api/auth/bridge/start?mode=evil', { headers: { host: 'pulse.axxes.app' } }));
  expect(new URL(response.headers.get('location')!).pathname).toBe('/sign-in');
  expect((await GET(new Request('https://evil.com/api/auth/bridge/start?mode=signup', { headers: { host: 'evil.com' } }))).status).toBe(400);
});
