/**
 * Zustand store for scan: capture state, last result, debug.
 * Use as needed; can be replaced with context if no zustand in project.
 */

export interface ScanResult {
  docType: 'passport' | 'tr_id' | 'tr_dl';
  imageUri?: string;
  imageBase64?: string;
  mrz?: {
    ok: boolean;
    confidence: number;
    fields: Record<string, unknown>;
    checks?: Record<string, boolean>;
  };
  doc?: {
    ok: boolean;
    confidence: number;
    fields: Record<string, unknown>;
  };
  correlationId?: string;
}

interface ScanState {
  captureState: 'IDLE' | 'SEARCHING' | 'LOCKING' | 'CAPTURING' | 'PROCESSING' | 'DONE' | 'FAILED';
  lastResult: ScanResult | null;
  lastScores: Record<string, number> | null;
  correlationId: string | null;
  debug: boolean;
}

type SetState = (fn: (s: ScanState) => Partial<ScanState>) => void;

let state: ScanState = {
  captureState: 'IDLE',
  lastResult: null,
  lastScores: null,
  correlationId: null,
  debug: false,
};

const listeners: Set<() => void> = new Set();

function emit() {
  listeners.forEach((cb) => cb());
}

export const scanStore = {
  getState(): ScanState {
    return { ...state };
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setCaptureState(captureState: ScanState['captureState']) {
    state = { ...state, captureState };
    emit();
  },
  setLastResult(result: ScanResult | null) {
    state = { ...state, lastResult: result };
    emit();
  },
  setLastScores(scores: Record<string, number> | null) {
    state = { ...state, lastScores: scores };
    emit();
  },
  setCorrelationId(id: string | null) {
    state = { ...state, correlationId: id };
    emit();
  },
  setDebug(debug: boolean) {
    state = { ...state, debug };
    emit();
  },
  reset() {
    state = {
      captureState: 'IDLE',
      lastResult: null,
      lastScores: null,
      correlationId: state.correlationId,
      debug: state.debug,
    };
    emit();
  },
};

function generateCorrelationId(): string {
  return `scan_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function useScanCorrelationId(): string {
  if (!state.correlationId) {
    state.correlationId = generateCorrelationId();
    emit();
  }
  return state.correlationId!;
}

export function resetScanCorrelationId(): void {
  state.correlationId = generateCorrelationId();
  emit();
}
