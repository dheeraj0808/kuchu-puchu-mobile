import type { LivenessCallbacks, LivenessCapture, LivenessInstruction, LivenessProvider } from './types';

const HEAD_TURNS: LivenessInstruction[] = ['turnLeft', 'turnRight', 'lookUp'];

/** Picks `count` random head-turn steps, never the same twice in a row. */
export function randomSteps(count: number, random: () => number = Math.random): LivenessInstruction[] {
  const steps: LivenessInstruction[] = [];
  for (let i = 0; i < count; i += 1) {
    let index = Math.min(HEAD_TURNS.length - 1, Math.floor(random() * HEAD_TURNS.length));
    // A repeat moves on to the next step instead of re-rolling, so this always ends.
    if (HEAD_TURNS[index] === steps[i - 1]) index = (index + 1) % HEAD_TURNS.length;
    steps.push(HEAD_TURNS[index]!);
  }
  return steps;
}

/**
 * Stand-in for a vendor SDK: centre → 3 random head turns → hold still,
 * with progress. Real providers draw their own camera UI or feed frames.
 */
export class MockLivenessProvider implements LivenessProvider {
  readonly name = 'mock';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private finish: ((r: LivenessCapture) => void) | null = null;

  constructor(
    private readonly stepMs = 1500,
    private readonly random: () => number = Math.random,
  ) {}

  start(_sessionId: string, { onInstruction, onProgress }: LivenessCallbacks): Promise<LivenessCapture> {
    this.cancel();
    const steps: LivenessInstruction[] = ['centre', ...randomSteps(3, this.random), 'holdStill'];
    return new Promise((resolve) => {
      this.finish = resolve;
      let i = 0;
      const tick = () => {
        if (i >= steps.length) {
          this.timer = null;
          this.finish = null;
          onProgress(1);
          resolve({ kind: 'captured' });
          return;
        }
        onInstruction(steps[i]!);
        onProgress(i / steps.length);
        i += 1;
        this.timer = setTimeout(tick, this.stepMs);
      };
      tick();
    });
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const finish = this.finish;
    this.finish = null;
    finish?.({ kind: 'cancelled' });
  }
}
