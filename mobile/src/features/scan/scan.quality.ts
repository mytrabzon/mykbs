/**
 * Frame quality scores (0..1): stability, blur, exposure, glare, docFound, mrzCandidate.
 * Placeholder implementations; with VisionCamera frame processor these would use real metrics.
 */

export interface FrameScores {
  stabilityScore: number;
  blurScore: number;
  exposureScore: number;
  glareScore: number;
  docFoundScore: number;
  mrzCandidateScore: number;
}

const defaultScores: FrameScores = {
  stabilityScore: 0.5,
  blurScore: 0.5,
  exposureScore: 0.7,
  glareScore: 0.2,
  docFoundScore: 0.5,
  mrzCandidateScore: 0.5,
};

/**
 * Compute frame quality scores from frame data.
 * With VisionCamera: pass frame (pixel buffer / image); here we return placeholders.
 * Real impl: stabilityScore from gyro + frame delta, blurScore from Laplacian variance, etc.
 */
export function computeFrameScores(_frame?: unknown): FrameScores {
  // TODO: when using VisionCamera frame processor, compute:
  // - stabilityScore: e.g. from motion/gyro + frame-to-frame delta
  // - blurScore: Laplacian variance normalized
  // - exposureScore: histogram
  // - glareScore: saturated pixel ratio
  // - docFoundScore: edge/corner detection
  // - mrzCandidateScore: lower band line density
  return { ...defaultScores };
}

/** Gate: should we trigger auto-capture? docFound > 0.75, stability > 0.85 for 900ms, blur > 0.70, exposure > 0.60, glare < 0.35, mrzCandidate > 0.70 (MRZ mode). */
export function passesCaptureGate(
  scores: FrameScores,
  options: { mrzMode?: boolean; stableMs?: number } = {}
): boolean {
  const { mrzMode = false } = options;
  if (scores.docFoundScore <= 0.75) return false;
  if (scores.stabilityScore <= 0.85) return false;
  if (scores.blurScore <= 0.7) return false;
  if (scores.exposureScore <= 0.6) return false;
  if (scores.glareScore >= 0.35) return false;
  if (mrzMode && scores.mrzCandidateScore <= 0.7) return false;
  return true;
}

/** User-facing message when gate fails. */
export function getQualityHint(scores: FrameScores): string | null {
  if (scores.glareScore >= 0.35) return 'Parlama var, biraz açıyı değiştir';
  if (scores.blurScore <= 0.7) return 'Telefonu sabitle';
  if (scores.docFoundScore <= 0.75) return 'Belgeyi çerçeveye hizala';
  if (scores.stabilityScore <= 0.85) return 'Sabit tutun';
  if (scores.exposureScore <= 0.6) return 'Işığı artırın';
  return null;
}
