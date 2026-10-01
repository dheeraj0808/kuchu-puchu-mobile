/**
 * One interface for every liveness vendor (guide §2, M11). The backend picks
 * the provider in POST /verification/face/session; AWS Face Liveness,
 * HyperVerge or IDfy implement this without changing any screen.
 */

/** What to tell the user right now (shown in the white pill on screen 07). */
export type LivenessInstruction = 'centre' | 'turnLeft' | 'turnRight' | 'lookUp' | 'holdStill';

export interface LivenessCallbacks {
  onInstruction: (instruction: LivenessInstruction) => void;
  /** 0–1 */
  onProgress: (fraction: number) => void;
}

/**
 * The provider only reports that capture finished. Whether the person is
 * verified is decided by the server in /verification/face/complete.
 */
export type LivenessCapture = { kind: 'captured' } | { kind: 'cancelled' } | { kind: 'failed'; reason: 'camera' | 'timeout' | 'provider' };

export interface LivenessProvider {
  readonly name: string;
  start(sessionId: string, callbacks: LivenessCallbacks): Promise<LivenessCapture>;
  /** Stops a running capture; its start() promise resolves with `cancelled`. */
  cancel(): void;
}
