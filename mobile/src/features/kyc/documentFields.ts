/**
 * Kimlik doğrulama: normalize alan seti (tek şema, tüm belgeler için).
 * MRZ / NFC DG1 / OCR → bu alanlara map edilir.
 * Loglarda asla tam document_number veya TCKN basılmaz.
 */

export type DocumentType = 'passport' | 'id' | 'driver_license';

export type VerificationSource = 'mrz' | 'nfc' | 'ocr';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

/** Tüm belge türleri için ortak normalize alanlar */
export interface NormalizedDocumentFields {
  document_type: DocumentType;
  issuing_country: string;
  /** Saklama: hash + masked; loglarda tam değer yok */
  document_number_masked?: string;
  given_names: string;
  surname: string;
  nationality: string;
  date_of_birth: string; // YYYY-MM-DD
  sex: 'M' | 'F' | 'U';
  date_of_expiry: string;
  date_of_issue?: string;
  /** Sadece ehliyet: B, C, D vb. */
  license_classes?: string;
  /** Sadece TR kimlik: 11 hane; loglarda tam basılmaz */
  national_id_masked?: string;
  mrz_present: boolean;
  nfc_present: boolean;
  face_image_present: boolean;
  confidence_score?: number; // 0–1
  verification_status: VerificationStatus;
  /** Kaynak: hangi kanaldan geldi (son yazılan kazanır / merge policy) */
  source?: VerificationSource;
}

/** MRZ parse çıktısını normalize alanlara map et */
export function mrzPayloadToNormalized(
  payload: {
    docType?: string;
    issuingCountry?: string;
    surname?: string;
    givenNames?: string;
    passportNumber?: string;
    nationality?: string;
    birthDate?: string;
    sex?: string;
    expiryDate?: string;
    raw?: string;
    checks?: { ok: boolean };
  },
  documentType: DocumentType
): Partial<NormalizedDocumentFields> {
  const sex = payload.sex === 'M' || payload.sex === 'F' ? payload.sex : 'U';
  return {
    document_type: documentType,
    issuing_country: payload.issuingCountry ?? '',
    document_number_masked: maskDocumentNumber(payload.passportNumber),
    given_names: payload.givenNames ?? '',
    surname: payload.surname ?? '',
    nationality: payload.nationality ?? '',
    date_of_birth: payload.birthDate ?? '',
    sex,
    date_of_expiry: payload.expiryDate ?? '',
    mrz_present: true,
    nfc_present: false,
    face_image_present: false,
    confidence_score: payload.checks?.ok ? 0.9 : 0.5,
    verification_status: 'pending',
    source: 'mrz',
  };
}

/** Belge numarası / TCKN maskele (log ve UI: ilk 2 + **** + son 2) */
export function maskDocumentNumber(value: string | null | undefined): string {
  if (!value || value.length < 4) return '****';
  return value.slice(0, 2) + '****' + value.slice(-2);
}

/** Hash için: belge no / TCKN → SHA-256 (backend veya client); DB'de document_number_hash saklanır */
export const DOCUMENT_NUMBER_HASH_ALG = 'SHA-256';

/** Form alanları: kilitli (readonly) olanlar otomatik dolduruldu; kullanıcı "Düzenle" ile açabilir (log’la) */
export const LOCKED_FIELDS_WHEN_AUTO_FILLED = [
  'document_type',
  'issuing_country',
  'document_number_masked',
  'given_names',
  'surname',
  'nationality',
  'date_of_birth',
  'sex',
  'date_of_expiry',
  'date_of_issue',
] as const;

/** Ek kullanıcı bilgileri (form adım 3): telefon, e-posta, rıza */
export interface VerificationConsentFields {
  phone?: string;
  email?: string;
  kvkk_consent: boolean;
  retention_days?: number; // 7–30
}
