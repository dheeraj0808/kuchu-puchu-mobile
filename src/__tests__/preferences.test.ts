import { CITIES, createMockPreferences } from '@/api/mocks/preferences';
import type { Me, OnboardingStep, Preferences } from '@/api/types';
import { ANDROID_CHANNELS, enablePush, ensureNotificationChannels, type PushDeps } from '@/features/notifications/push';
import { requestApproximateLocation } from '@/features/onboarding/deviceLocation';
import { defaultAgeRange, preferencesProblem } from '@/features/onboarding/preferences';
import { sendLocation } from '@/features/onboarding/sendLocation';
import { resolveOnboardingScreen } from '@/features/onboarding/steps';
import { debounce } from '@/lib/debounce';
import { createLocationThrottle, LOCATION_MIN_INTERVAL_MS, roundCoordinate } from '@/lib/locationThrottle';

jest.mock('expo-secure-store', () => ({}));
jest.mock('expo-location', () => ({ Accuracy: { Low: 2 } }));
jest.mock('expo-notifications', () => ({ AndroidImportance: { DEFAULT: 5, HIGH: 6, MAX: 7 } }));

const valid: Preferences = { showMe: 'women', ageMin: 24, ageMax: 32, maxDistanceKm: 25 };

describe('preferences validation', () => {
  it('accepts the deck defaults and the extremes', () => {
    expect(preferencesProblem(valid)).toBeNull();
    expect(preferencesProblem({ ...valid, ageMin: 18, ageMax: 100, maxDistanceKm: 1 })).toBeNull();
    expect(preferencesProblem({ ...valid, ageMin: 30, ageMax: 30, maxDistanceKm: 200 })).toBeNull();
  });

  it.each([
    [{ showMe: undefined }, 'showMe'],
    [{ ageMin: 33, ageMax: 32 }, 'ageOrder'],
    [{ ageMin: 17 }, 'ageRange'],
    [{ ageMax: 101 }, 'ageRange'],
    [{ ageMin: 24.5 }, 'ageRange'],
    [{ maxDistanceKm: 0 }, 'distance'],
    [{ maxDistanceKm: 201 }, 'distance'],
  ])('%p → %p', (patch, problem) => {
    expect(preferencesProblem({ ...valid, ...patch })).toBe(problem);
  });

  it('defaults the range around the user’s age, inside 18–100', () => {
    expect(defaultAgeRange(26)).toEqual([24, 32]);
    expect(defaultAgeRange(19)).toEqual([18, 25]);
    expect(defaultAgeRange(97)).toEqual([95, 100]);
    expect(defaultAgeRange(null)).toEqual([24, 32]);
  });
});

describe('location permission routing', () => {
  const position = { coords: { latitude: 12.971598, longitude: 77.594566 } };

  it('granted → rounded (~1 km) coordinates to save', async () => {
    const outcome = await requestApproximateLocation({
      requestPermission: async () => ({ granted: true }),
      getPosition: async () => position,
    });
    expect(outcome).toEqual({ kind: 'granted', lat: 12.97, lng: 77.59 });
  });

  it('denied → city picker, without ever asking for a position', async () => {
    const getPosition = jest.fn();
    const outcome = await requestApproximateLocation({ requestPermission: async () => ({ granted: false }), getPosition });
    expect(outcome).toEqual({ kind: 'denied' });
    expect(getPosition).not.toHaveBeenCalled();
  });

  it('no fix or a failing prompt also fall back to the city picker', async () => {
    await expect(
      requestApproximateLocation({ requestPermission: async () => ({ granted: true }), getPosition: () => Promise.reject(new Error('GPS off')) }),
    ).resolves.toEqual({ kind: 'unavailable' });
    await expect(
      requestApproximateLocation({ requestPermission: () => Promise.reject(new Error('x')), getPosition: jest.fn() }),
    ).resolves.toEqual({ kind: 'denied' });
  });

  it('rounds to two decimals', () => {
    expect(roundCoordinate(19.0759837)).toBe(19.08);
    expect(roundCoordinate(-0.004)).toBe(-0);
  });
});

describe('15-minute location throttle', () => {
  it('allows one GPS send per 15 minutes', () => {
    let now = 0;
    const throttle = createLocationThrottle(() => now);
    expect(throttle.canSend()).toBe(true);
    throttle.markSent();
    now = LOCATION_MIN_INTERVAL_MS - 1;
    expect(throttle.canSend()).toBe(false);
    now = LOCATION_MIN_INTERVAL_MS;
    expect(throttle.canSend()).toBe(true);
  });

  it('skips a second GPS update inside the window, but a city choice always goes', async () => {
    let now = 0;
    const throttle = createLocationThrottle(() => now);
    const put = jest.fn(async () => ({ source: 'gps' as const, city: null }));
    await expect(sendLocation({ lat: 12.97, lng: 77.59 }, { put, throttle })).resolves.toMatchObject({ source: 'gps' });
    now = 5 * 60_000;
    await expect(sendLocation({ lat: 12.98, lng: 77.6 }, { put, throttle })).resolves.toBeNull();
    await sendLocation({ cityId: 'blr' }, { put, throttle });
    expect(put).toHaveBeenCalledTimes(2);
    now = 16 * 60_000;
    await sendLocation({ lat: 12.98, lng: 77.6 }, { put, throttle });
    expect(put).toHaveBeenCalledTimes(3);
  });
});

describe('city search debounce (300 ms)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('searches once, 300 ms after the last keystroke', () => {
    const search = jest.fn();
    const onType = debounce(search, 300);
    for (const q of ['B', 'Be', 'Ben']) {
      onType(q);
      jest.advanceTimersByTime(100);
    }
    expect(search).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('Ben');
  });

  it('cancel drops a pending search (screen closed)', () => {
    const search = jest.fn();
    const onType = debounce(search, 300);
    onType('Mum');
    onType.cancel();
    jest.advanceTimersByTime(1000);
    expect(search).not.toHaveBeenCalled();
  });

  it('mock results match the deck for "Be"', async () => {
    jest.useRealTimers();
    const mock = createMockPreferences(() => ({ nextStep: 'preferences', profile: null }), async () => 't', Date.now, 0);
    const names = (await mock.searchCities('Be')).map((c) => c.name);
    expect(names).toEqual(['Bengaluru', 'Belagavi', 'Bengaluru Rural']);
    expect(await mock.searchCities('  ')).toEqual([]);
    expect((await mock.searchCities('bho')).map((c) => c.name)).toEqual(['Bhopal']);
  });
});

describe('notifications: channels, prompt, skip', () => {
  const deps = (over: Partial<PushDeps> = {}): PushDeps & { order: string[] } => {
    const order: string[] = [];
    return {
      order,
      platform: 'android',
      setChannel: jest.fn(async (id: string) => void order.push(`channel:${id}`)),
      requestPermission: jest.fn(async () => {
        order.push('prompt');
        return { granted: true };
      }),
      getDeviceToken: jest.fn(async () => ({ data: 'fcm-real-token' })),
      useMock: false,
      fakeToken: () => 'mock-fcm-1',
      ...over,
    };
  };

  it('creates the 5 guide channels before the Android 13 prompt', async () => {
    const d = deps();
    await expect(enablePush(d)).resolves.toEqual({ granted: true, token: 'fcm-real-token' });
    expect(ANDROID_CHANNELS.map((c) => c.id)).toEqual(['matches', 'messages', 'likes', 'account_security', 'calls']);
    expect(d.order.slice(0, 5).every((s) => s.startsWith('channel:'))).toBe(true);
    expect(d.order[5]).toBe('prompt');
  });

  it('denied → no token requested', async () => {
    const d = deps({ requestPermission: async () => ({ granted: false }) });
    await expect(enablePush(d)).resolves.toEqual({ granted: false });
    expect(d.getDeviceToken).not.toHaveBeenCalled();
  });

  it('no FCM configured → fake token in mock mode, none otherwise', async () => {
    const failing = () => Promise.reject(new Error('Default FirebaseApp is not initialized'));
    await expect(enablePush(deps({ getDeviceToken: failing, useMock: true }))).resolves.toEqual({ granted: true, token: 'mock-fcm-1' });
    await expect(enablePush(deps({ getDeviceToken: failing, useMock: false }))).resolves.toEqual({ granted: true, token: null });
  });

  it('no channels outside Android', async () => {
    const d = deps({ platform: 'ios' });
    await ensureNotificationChannels(d);
    expect(d.setChannel).not.toHaveBeenCalled();
  });

  it('"Not now" (token null) still finishes onboarding', async () => {
    const account = { nextStep: 'preferences' as OnboardingStep, profile: null, preferences: valid, location: { source: 'city' as const, city: 'Bengaluru' } };
    const mock = createMockPreferences(() => account, async () => 't', Date.now, 0);
    await expect(mock.putPushDevice({ token: null, platform: 'android' })).resolves.toEqual({ message: 'Push declined' });
    expect(account.nextStep).toBe('done');
  });
});

describe('gate order: preferences → location → notifications → done', () => {
  const user = (over: Partial<Me>) =>
    ({ nextStep: 'preferences', profile: null, preferences: null, location: null, notificationsChoiceAt: null, ...over }) as Me;

  it.each([
    [{}, 'preferences'],
    [{ preferences: valid }, 'location'],
    [{ preferences: valid, location: { source: 'gps', city: null } }, 'notifications'],
    [{ preferences: valid, location: { source: 'city', city: 'Pune' }, notificationsChoiceAt: 'x' }, 'later'],
    [{ nextStep: 'done' }, 'later'],
  ] as const)('%p → %s', (over, screen) => {
    expect(resolveOnboardingScreen(user(over as Partial<Me>))).toBe(screen);
  });

  it('mock run: nextStep only reaches done after all three, in order', async () => {
    const account: { nextStep: OnboardingStep; profile: null } & Partial<Me> = { nextStep: 'preferences', profile: null };
    const mock = createMockPreferences(() => account as never, async () => 't', Date.now, 0);
    const screen = () => resolveOnboardingScreen(user(account));

    expect(screen()).toBe('preferences');
    await expect(mock.putPreferences({ ...valid, ageMin: 40, ageMax: 30 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await mock.putPreferences(valid);
    expect(screen()).toBe('location');
    await expect(mock.putLocation({ cityId: 'nowhere' })).rejects.toMatchObject({ status: 404 });
    await mock.putLocation({ cityId: CITIES[0]!.id });
    expect(account.location).toEqual({ source: 'city', city: 'Bengaluru' });
    expect(screen()).toBe('notifications');
    expect(account.nextStep).toBe('preferences');
    await mock.putPushDevice({ token: 'mock-fcm-1', platform: 'android' });
    expect(account.nextStep).toBe('done');
    expect(screen()).toBe('later');
  });

  it('GPS location is reduced to "near you" and never kept as coordinates', async () => {
    const account: { nextStep: OnboardingStep; profile: null } & Partial<Me> = { nextStep: 'preferences', profile: null };
    const mock = createMockPreferences(() => account as never, async () => 't', Date.now, 0);
    await mock.putLocation({ lat: 12.97, lng: 77.59 });
    expect(JSON.stringify(account)).not.toMatch(/12\.97|77\.59/);
  });
});
