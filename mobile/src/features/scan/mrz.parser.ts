/**
 * MRZ on-device parse: TD1/TD2/TD3 + check digit + autocorrect.
 * Uses lib/mrz parseMrz + fixMrzOcrErrors. Confidence: full pass 95-100, 1 fail 85-94, else <70.
 * Rule: mobile confidence < 90 → call backend.
 */

import { parseMrz, fixMrzOcrErrors } from '../../lib/mrz';
import type { MrzFields, MrzChecks } from './scan.types';

function mapToChecks(checks: { ok?: boolean; reason?: string } | undefined): MrzChecks {
  if (!checks) {
    return { passportNoCheck: false, birthCheck: false, expiryCheck: false, compositeCheck: false };
  }
  const ok = !!checks.ok;
  const reason = checks.reason || '';
  return {
    passportNoCheck: ok ? true : reason !== 'document_number_check',
    birthCheck: ok ? true : reason !== 'birth_date_check',
    expiryCheck: ok ? true : reason !== 'expiry_date_check',
    compositeCheck: ok,
  };
}

function mapToFields(parsed: ReturnType<typeof parseMrz>): MrzFields {
  return {
    documentNumber: parsed.passportNumber || '',
    nationality: parsed.nationality || '',
    surname: parsed.surname || '',
    givenNames: parsed.givenNames || '',
    birthDate: parsed.birthDate || '',
    sex: parsed.sex || 'U',
    expiryDate: parsed.expiryDate || '',
    issuingCountry: parsed.issuingCountry || '',
    optionalData: undefined,
  };
}

/**
 * Compute confidence 0..100 from parse result.
 * Full check pass -> 95-100; 1 check fail (autocorrect may fix) -> 85-94; format/length -> <70.
 */
function confidenceFromParsed(parsed: ReturnType<typeof parseMrz>): number {
  if (!parsed.checks) return 0;
  if (parsed.checks.ok) return 97;
  const reason = parsed.checks.reason || '';
  if (reason === 'document_number_check' || reason === 'birth_date_check' || reason === 'expiry_date_check') return 88;
  if (reason === 'invalid_format' || reason === 'empty_input') return 65;
  return 70;
}

export interface OnDeviceMrzResult {
  ok: boolean;
  confidence: number;
  fields: MrzFields;
  checks: MrzChecks;
  raw: string;
}

/**
 * Parse MRZ raw string on device. Optionally try fixMrzOcrErrors first.
 */
export function parseMrzOnDevice(raw: string, tryAutocorrect = true): OnDeviceMrzResult | null {
  let input = raw?.trim() || '';
  if (!input) return null;

  if (tryAutocorrect) {
    input = fixMrzOcrErrors(input) || input;
  }

  const parsed = parseMrz(input);
  const checks = mapToChecks(parsed.checks);
  const fields = mapToFields(parsed);
  const confidence = confidenceFromParsed(parsed);

  return {
    ok: parsed.checks?.ok ?? false,
    confidence,
    fields,
    checks,
    raw: input,
  };
}

/** Should we call backend for MRZ? (confidence < 90) */
export function shouldFallbackToBackend(confidence: number): boolean {
  return confidence < 90;
}
