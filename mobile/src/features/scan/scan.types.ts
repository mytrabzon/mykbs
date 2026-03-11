/**
 * Scan feature types: doc type, MRZ result, API responses.
 */

export type ScanDocType = 'passport' | 'tr_id' | 'tr_dl';

export type MrzDocTypeHint = 'passport' | 'id' | 'unknown';

export interface MrzFields {
  documentNumber: string;
  /** T.C. kimlik no (11 hane) — TUR belgelerde doldurulur */
  kimlikNo?: string | null;
  /** Pasaport / belge no — TUR dışı veya pasaport */
  pasaportNo?: string | null;
  nationality: string;
  surname: string;
  givenNames: string;
  birthDate: string; // YYYY-MM-DD
  sex: string;
  expiryDate: string;
  issuingCountry: string;
  optionalData?: string;
}

export interface MrzChecks {
  passportNoCheck: boolean;
  birthCheck: boolean;
  expiryCheck: boolean;
  compositeCheck: boolean;
}

export interface MrzParseResponse {
  ok: boolean;
  confidence: number;
  mrzRawMasked?: string;
  fields: MrzFields;
  checks: MrzChecks;
  errorCode?: string;
}

export type DocParseDocType = 'tr_id_front' | 'tr_dl_front' | 'unknown_front';

export interface TrIdFields {
  ad?: string;
  soyad?: string;
  tcKimlikNo?: string | null;
  dogumTarihi?: string | null;
  seriNo?: string | null;
  uyruk?: string;
}

export interface TrDlFields {
  ad?: string;
  soyad?: string;
  dogumTarihi?: string | null;
  belgeNo?: string | null;
  gecerlilik?: string | null;
  sinif?: string | null;
}

export interface DocParseResponse {
  ok: boolean;
  confidence: number;
  fields: TrIdFields | TrDlFields | Record<string, unknown>;
  errorCode?: string;
}

/** Auto-capture state machine */
export type ScanCaptureState =
  | 'IDLE'
  | 'SEARCHING'
  | 'LOCKING'
  | 'CAPTURING'
  | 'PROCESSING'
  | 'DONE'
  | 'FAILED';

/** Frame quality scores 0..1 */
export interface FrameScores {
  stabilityScore: number;
  blurScore: number;
  exposureScore: number;
  glareScore: number;
  docFoundScore: number;
  mrzCandidateScore: number;
}
