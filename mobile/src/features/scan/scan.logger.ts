/**
 * Scan event logger: ring buffer (last 500 events) + PII mask.
 * Events: scan_opened, frame_quality, auto_capture_triggered, photo_captured, on_device_parse_done, backend_parse_requested, backend_parse_done, user_edit_used, scan_confirmed, scan_failed.
 */

const RING_SIZE = 500;

export type ScanEventName =
  | 'scan_opened'
  | 'frame_quality'
  | 'auto_capture_triggered'
  | 'photo_captured'
  | 'on_device_parse_done'
  | 'backend_parse_requested'
  | 'backend_parse_done'
  | 'user_edit_used'
  | 'scan_confirmed'
  | 'scan_failed';

export interface ScanEventMeta {
  correlationId?: string;
  userId?: string;
  docType?: string;
  deviceModel?: string;
  appVersion?: string;
  timings?: Record<string, number>;
  [key: string]: unknown;
}

interface ScanEvent {
  name: ScanEventName;
  at: number;
  meta: ScanEventMeta;
}

const ring: ScanEvent[] = [];
let ringIndex = 0;

function maskMiddle(value: string | null | undefined, visible = 2): string {
  if (value == null || typeof value !== 'string') return '';
  const s = value.trim();
  if (s.length <= visible * 2) return '****';
  return s.slice(0, visible) + '******' + s.slice(-visible);
}

/** Mask MRZ or doc number for logging (no full PII). */
export function maskForLog(value: string | null | undefined): string {
  return maskMiddle(value, 2);
}

function pushEvent(name: ScanEventName, meta: ScanEventMeta) {
  const event: ScanEvent = { name, at: Date.now(), meta };
  ring[ringIndex % RING_SIZE] = event;
  ringIndex += 1;
}

export const scanLogger = {
  scan_opened(meta: ScanEventMeta = {}) {
    pushEvent('scan_opened', meta);
  },
  frame_quality(meta: ScanEventMeta & { scores?: Record<string, number> }) {
    pushEvent('frame_quality', meta);
  },
  auto_capture_triggered(meta: ScanEventMeta) {
    pushEvent('auto_capture_triggered', meta);
  },
  photo_captured(meta: ScanEventMeta) {
    pushEvent('photo_captured', meta);
  },
  on_device_parse_done(meta: ScanEventMeta & { confidence?: number; masked?: string }) {
    pushEvent('on_device_parse_done', meta);
  },
  backend_parse_requested(meta: ScanEventMeta) {
    pushEvent('backend_parse_requested', meta);
  },
  backend_parse_done(meta: ScanEventMeta & { ok?: boolean; confidence?: number }) {
    pushEvent('backend_parse_done', meta);
  },
  user_edit_used(meta: ScanEventMeta) {
    pushEvent('user_edit_used', meta);
  },
  scan_confirmed(meta: ScanEventMeta) {
    pushEvent('scan_confirmed', meta);
  },
  scan_failed(meta: ScanEventMeta & { errorCode?: string }) {
    pushEvent('scan_failed', meta);
  },
};

/** Get last N events (for debug UI). */
export function getLastScanEvents(count = 50): ScanEvent[] {
  const total = Math.min(ringIndex, RING_SIZE);
  const start = (ringIndex - total + RING_SIZE) % RING_SIZE;
  const out: ScanEvent[] = [];
  for (let i = 0; i < total && out.length < count; i++) {
    const idx = (start + i) % RING_SIZE;
    if (ring[idx]) out.push(ring[idx]);
  }
  return out.slice(-count).reverse();
}
