import type { FaceSession } from '@/api/types';

import { MockLivenessProvider } from './MockLivenessProvider';
import type { LivenessProvider } from './types';

export * from './types';

/**
 * The provider for a session. Only the mock exists today; add AWS /
 * HyperVerge / IDfy adapters here when the vendor is chosen.
 */
export function providerFor(session: FaceSession): LivenessProvider {
  switch (session.provider) {
    case 'mock':
    default:
      return new MockLivenessProvider();
  }
}
