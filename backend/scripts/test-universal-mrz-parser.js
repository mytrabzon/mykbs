/**
 * Evrensel MRZ Parser testi (TD1/TD2/TD3 örnekleri)
 * Çalıştırma: node scripts/test-universal-mrz-parser.js
 */

const { UniversalMrzParser } = require('../src/lib/mrz/universalMrzParser');

// TD3 örnek (pasaport - 2 satır 44 karakter). Satır2: doc 0-9, check 9, nationality 10-13, birth 13-19, sex 20, expiry 21-27
const TD3_SAMPLE = `P<TURKMEKOV<<ALI<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
U12345678<TUR8001014M2501015<<<<<<<<<<<<<<<<<6`;

// TD1 örnek (T.C. kimlik - 3 satır 30 karakter)
const TD1_SAMPLE = `I<TUR1234567890123456789012345
8001015M2501015TUR<<<<<<<<<<<<<<<0
ACAR<<HAKAN<<<<<<<<<<<<<<<<<<<<<<<`;

// TD2 örnek (vize/ehliyet - 2 satır 36 karakter). Satır2: docNo 0-9, check 9, nationality 10-12, birth 13-18, check 19, sex 20, expiry 21-27
const TD2_SAMPLE = `I<TURKMEKOV<<ALI<<<<<<<<<<<<<<<<<<
U123456780TUR8001014M2501015<<<<<<<<<<`;

function test(name, mrz, expectedFormat) {
  const parsed = UniversalMrzParser.parse(mrz);
  const ok = parsed.format === expectedFormat;
  console.log(ok ? '[OK]' : '[FAIL]', name, '-> format:', parsed.format, ok ? '' : '(expected ' + expectedFormat + ')');
  if (parsed.format !== 'UNKNOWN') {
    console.log('     surname:', parsed.surname, '| givenName:', parsed.givenName, '| birthDate:', parsed.birthDate, '| docNo:', parsed.documentNumber || parsed.personalNumber);
  }
  return ok;
}

console.log('--- Universal MRZ Parser Tests ---\n');

test('TD3 (pasaport)', TD3_SAMPLE, 'TD3');
test('TD1 (T.C. kimlik)', TD1_SAMPLE, 'TD1');
test('TD2 (vize/ehliyet)', TD2_SAMPLE, 'TD2');

// Tek blok TD3
const td3OneLine = TD3_SAMPLE.replace(/\n/g, '');
test('TD3 tek blok', td3OneLine, 'TD3');

console.log('\n--- Bitti ---');
