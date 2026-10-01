import * as verificationApi from '@/api/endpoints/verification';
import { ErrorCode, isApiError } from '@/api/errors';
import type { FaceResult, FaceSession } from '@/api/types';

import { providerFor, type LivenessInstruction, type LivenessProvider } from './liveness';

/** What screen 07 shows. */
export type SelfieState =
  | { kind: 'starting' }
  | { kind: 'capturing'; instruction: LivenessInstruction; progress: number }
  | { kind: 'checking' }
  /** Server approved: the gate moves to photos once /auth/me reloads. */
  | { kind: 'approved' }
  /** Server wants a human check: screen 08. */
  | { kind: 'review' }
  | { kind: 'rejected'; reason: string | null; attemptsLeft: number | null }
  | { kind: 'exceeded' }
  | { kind: 'error'; message: string };

export type SelfieRoute = 'photos' | 'review' | 'retry';

/** The server decision → where the user goes. Never trusts the provider's own result. */
export function routeForFaceResult(result: FaceResult): SelfieRoute {
  if (result.status === 'approved') return 'photos';
  if (result.status === 'review') return 'review';
  return 'retry';
}

interface Deps {
  createSession: () => Promise<FaceSession>;
  complete: (sessionId: string) => Promise<FaceResult>;
  providerFor: (session: FaceSession) => LivenessProvider;
}

const defaultDeps: Deps = {
  createSession: () => verificationApi.createFaceSession(),
  complete: (id) => verificationApi.completeFaceSession(id),
  providerFor,
};

/**
 * Runs one live-selfie attempt: session → provider capture → /face/complete.
 * Going to the background mid-capture cancels it and starts a fresh session
 * on return (guide §10.3). Screen-independent so it can be tested.
 */
export class SelfieController {
  private provider: LivenessProvider | null = null;
  private runId = 0;
  private interrupted = false;
  state: SelfieState = { kind: 'starting' };

  constructor(
    private readonly onChange: (state: SelfieState) => void,
    private readonly errorText: (err: unknown) => string,
    private readonly deps: Deps = defaultDeps,
  ) {}

  async start(): Promise<void> {
    const run = ++this.runId;
    this.interrupted = false;
    this.set({ kind: 'starting' });
    try {
      const session = await this.deps.createSession();
      if (run !== this.runId) return;
      this.provider = this.deps.providerFor(session);
      const capture = await this.provider.start(session.sessionId, {
        onInstruction: (instruction) => run === this.runId && this.set({ kind: 'capturing', instruction, progress: this.progressOf() }),
        onProgress: (progress) => {
          if (run === this.runId && this.state.kind === 'capturing') this.set({ ...this.state, progress });
        },
      });
      this.provider = null;
      if (run !== this.runId || capture.kind === 'cancelled') return;
      if (capture.kind === 'failed') {
        this.set({ kind: 'error', message: this.errorText(null) });
        return;
      }
      this.set({ kind: 'checking' });
      const result = await this.deps.complete(session.sessionId);
      if (run !== this.runId) return;
      const route = routeForFaceResult(result);
      this.set(
        route === 'photos'
          ? { kind: 'approved' }
          : route === 'review'
            ? { kind: 'review' }
            : { kind: 'rejected', reason: result.reason ?? null, attemptsLeft: result.attemptsLeft ?? null },
      );
    } catch (err) {
      if (run !== this.runId) return;
      if (isApiError(err) && err.code === ErrorCode.VerificationAttemptsExceeded) this.set({ kind: 'exceeded' });
      else this.set({ kind: 'error', message: this.errorText(err) });
    }
  }

  /** AppState changes: leaving mid-capture cancels; coming back restarts with a new session. */
  onAppState(status: 'active' | 'background' | 'inactive' | string): void {
    const busy = this.state.kind === 'starting' || this.state.kind === 'capturing';
    if (status !== 'active' && busy) {
      this.interrupted = true;
      this.stop();
    } else if (status === 'active' && this.interrupted) {
      void this.start();
    }
  }

  /** Close (X) or unmount. */
  stop(): void {
    this.runId += 1;
    this.provider?.cancel();
    this.provider = null;
  }

  private progressOf(): number {
    return this.state.kind === 'capturing' ? this.state.progress : 0;
  }

  private set(state: SelfieState): void {
    this.state = state;
    this.onChange(state);
  }
}
