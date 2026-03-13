/**
 * Profesyonel belge okuyucu servisi (Regula Document Reader SDK).
 * SDK yüklü ve lisanslı değilse isDocumentReaderAvailable() false döner; showScanner atar.
 * Lisans: https://regulaforensics.com/ — Bundle ID: com.litxtech.kbsprime
 */

let DocumentReaderNative = null;
try {
  const pkg = require('react-native-regula-document-reader');
  DocumentReaderNative = pkg.default;
} catch (_) {
  DocumentReaderNative = null;
}

const DOCUMENT_READER_UNAVAILABLE = 'DOCUMENT_READER_UNAVAILABLE';

/**
 * Profesyonel SDK yüklü mü?
 * @returns {boolean}
 */
export function isDocumentReaderAvailable() {
  return DocumentReaderNative != null;
}

/**
 * Document Reader'ı lisans ile başlat. SDK yoksa sessizce atlanır.
 * @param {string} [licenseKey] - Regula lisans metni (base64 veya ham)
 * @returns {Promise<{ initialized: boolean; error?: string }>}
 */
export async function initializeDocumentReader(licenseKey) {
  if (!DocumentReaderNative) {
    return { initialized: false, error: DOCUMENT_READER_UNAVAILABLE };
  }
  try {
    await DocumentReaderNative.initializeReader({
      license: licenseKey || '',
      // databasePath: 'regula_db_2026.db', // Güncel DB 16.000+ belge
    });
    await DocumentReaderNative.setConfig?.({
      processParams: {
        scenario: 'FullProcess',
        checkHologram: true,
        checkOVI: true,
        checkMRZ: true,
        comparePortrait: true,
      },
      multipageProcessing: true,
    });
    return { initialized: true };
  } catch (error) {
    const message = error?.message || String(error);
    return { initialized: false, error: message };
  }
}

/**
 * SDK'nın kendi tarayıcı UI'ını açar. Başarıda sonuç objesi, iptal/hata da atar.
 * @param {{ language?: string; showHelpAnimation?: boolean; documentTypes?: string }} [options]
 * @returns {Promise<{ graphqlResult?: { document?: { fields?: Array<{ fieldName: string; value: string }>; mrz?: string; portrait?: string } } }; mrz?: string }>}
 */
export async function showScanner(options = {}) {
  if (!DocumentReaderNative) {
    throw new Error(DOCUMENT_READER_UNAVAILABLE);
  }
  const result = await DocumentReaderNative.showScanner({
    language: options.language || 'tr',
    showHelpAnimation: options.showHelpAnimation !== false,
    documentTypes: options.documentTypes || 'All',
  });
  return result;
}
