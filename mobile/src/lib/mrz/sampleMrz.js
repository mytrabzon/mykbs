/**
 * Demo mod için örnek MRZ (ICAO 9303 uyumlu, check digit'ler doğru).
 * Pipeline'ın çalıştığını test etmek için kullanılır.
 */
import { parseMrz } from './parseMrz';

// TD3 pasaport örneği (44+44 karakter)
const SAMPLE_MRZ_RAW =
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<<<<<<<\n' +
  'L898902C36UTO7408122F1204159ZE184226B<<<<<<<10';

/**
 * Demo mod için parse edilmiş örnek payload.
 * @returns {import('./mrzTypes').MrzPayload}
 */
export function getSampleMrzPayload() {
  const parsed = parseMrz(SAMPLE_MRZ_RAW);
  return { ...parsed, raw: SAMPLE_MRZ_RAW };
}

export { SAMPLE_MRZ_RAW };
