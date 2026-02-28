/**
 * Auto-capture state machine: IDLE → SEARCHING → LOCKING → CAPTURING → PROCESSING → DONE | FAILED.
 * Gate: docFound > 0.75, stability > 0.85 for 900ms, blur > 0.70, exposure > 0.60, glare < 0.35.
 */

import type { FrameScores } from './scan.quality';
import { passesCaptureGate } from './scan.quality';

export type CaptureState = 'IDLE' | 'SEARCHING' | 'LOCKING' | 'CAPTURING' | 'PROCESSING' | 'DONE' | 'FAILED';

const STABLE_MS = 900;

export interface AutoCaptureMachine {
  state: CaptureState;
  stableStartedAt: number | null;
  tick: (scores: FrameScores, mrzMode: boolean) => CaptureState;
  requestCapture: () => CaptureState;
  setProcessing: () => void;
  setDone: () => void;
  setFailed: () => void;
  reset: () => void;
}

export function createAutoCaptureMachine(): AutoCaptureMachine {
  let state: CaptureState = 'IDLE';
  let stableStartedAt: number | null = null;

  function tick(scores: FrameScores, mrzMode: boolean): CaptureState {
    if (state === 'CAPTURING' || state === 'PROCESSING' || state === 'DONE' || state === 'FAILED') {
      return state;
    }

    const passes = passesCaptureGate(scores, { mrzMode, stableMs: STABLE_MS });

    if (!passes) {
      if (state === 'LOCKING') state = 'SEARCHING';
      stableStartedAt = null;
      if (state === 'IDLE') state = 'SEARCHING';
      return state;
    }

    if (state === 'IDLE' || state === 'SEARCHING') {
      state = 'LOCKING';
      stableStartedAt = Date.now();
      return state;
    }

    if (state === 'LOCKING') {
      const elapsed = Date.now() - (stableStartedAt ?? 0);
      if (elapsed >= STABLE_MS) {
        state = 'CAPTURING';
        stableStartedAt = null;
      }
      return state;
    }

    return state;
  }

  function requestCapture(): CaptureState {
    if (state === 'SEARCHING' || state === 'LOCKING') {
      state = 'CAPTURING';
      stableStartedAt = null;
    }
    return state;
  }

  function setProcessing(): void {
    state = 'PROCESSING';
  }

  function setDone(): void {
    state = 'DONE';
  }

  function setFailed(): void {
    state = 'FAILED';
  }

  function reset(): void {
    state = 'IDLE';
    stableStartedAt = null;
  }

  return {
    get state() {
      return state;
    },
    get stableStartedAt() {
      return stableStartedAt;
    },
    tick,
    requestCapture,
    setProcessing,
    setDone,
    setFailed,
    reset,
  };
}
