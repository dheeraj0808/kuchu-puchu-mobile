import { fetchLaunchState, parseAppConfig } from '@/api/appConfig';
import { retryTiming } from '@/api/http';
import { compareVersions, isBelowVersion } from '@/lib/version';

jest.mock('expo-secure-store', () => ({}));
jest.mock('@/auth/device', () => ({ getDeviceId: async () => 'android:test-device' }));

const respond = (status: number, body: unknown) => {
  globalThis.fetch = jest.fn(async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
};

beforeEach(() => {
  retryTiming.sleep = async () => undefined;
});

describe('compareVersions', () => {
  it.each([
    ['1.0.0', '1.0.0', 0],
    ['1.2', '1.2.0', 0],
    ['1.9.0', '1.10.0', -1],
    ['2.0.0', '1.99.99', 1],
    ['1.4.0-rc.1', '1.4.0', 0],
    ['v1.4.1', '1.4.0', 1],
  ])('%s vs %s → %i', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });

  it('isBelowVersion', () => {
    expect(isBelowVersion('1.0.0', '1.0.1')).toBe(true);
    expect(isBelowVersion('1.0.1', '1.0.1')).toBe(false);
  });
});

describe('fetchLaunchState', () => {
  it('ready when the build meets minVersion', async () => {
    respond(200, { success: true, data: { minVersion: '1.0.0' } });
    await expect(fetchLaunchState('1.2.0')).resolves.toMatchObject({ kind: 'ready' });
  });

  it('updateRequired below minVersion', async () => {
    respond(200, { success: true, data: { minVersion: '1.3.0', storeUrl: 'https://play.google.com/x' } });
    const state = await fetchLaunchState('1.2.9');
    expect(state.kind).toBe('updateRequired');
    expect(state.kind === 'updateRequired' && state.config.storeUrl).toBe('https://play.google.com/x');
  });

  it('maintenance wins over everything else', async () => {
    respond(200, { success: true, data: { minVersion: '9.0.0', maintenance: { enabled: true } } });
    await expect(fetchLaunchState('1.0.0')).resolves.toMatchObject({ kind: 'maintenance' });
  });

  it('a 503 from the API means maintenance', async () => {
    respond(503, { success: false, code: 'INTERNAL_ERROR', message: 'x' });
    await expect(fetchLaunchState('1.0.0')).resolves.toMatchObject({ kind: 'maintenance', config: null });
  });

  it('404 (route not deployed yet) starts without restrictions', async () => {
    respond(404, { success: false, code: 'NOT_FOUND', message: 'Not found' });
    await expect(fetchLaunchState('1.0.0')).resolves.toMatchObject({ kind: 'ready' });
  });

  it('network failure is thrown for the Offline screen', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    await expect(fetchLaunchState('1.0.0')).rejects.toMatchObject({ kind: 'network' });
  });

  it('ignores malformed fields and non-HTTPS store links', () => {
    expect(parseAppConfig({ minVersion: 42, storeUrl: 'javascript:alert(1)', maintenance: 'yes' })).toEqual({
      minVersion: null,
      latestVersion: null,
      storeUrl: null,
      maintenance: { enabled: false, endsAt: null },
    });
  });
});
