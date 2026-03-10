/**
 * Belgeleri oda bazlı gruplama ve gelişmiş arama
 */

/**
 * @param {Array} items - Okutulan belge veya stay listesi
 * @param {string} searchQuery - Arama metni (ad, soyad, belge no)
 * @returns {Array} Filtrelenmiş liste
 */
export function filterDocumentsBySearch(items, searchQuery) {
  if (!searchQuery || typeof searchQuery !== 'string') return items;
  const q = searchQuery.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const ad = (item.ad || item.givenNames || '').toLowerCase();
    const soyad = (item.soyad || item.surname || '').toLowerCase();
    const belgeNo = (item.belgeNo || item.pasaportNo || item.kimlikNo || item.passportNumber || '').toString().toLowerCase();
    const odaNo = (item.odaNumarasi || item.roomNo || item.oda_no || '').toString().toLowerCase();
    return ad.includes(q) || soyad.includes(q) || belgeNo.includes(q) || odaNo.includes(q);
  });
}

/**
 * @param {Array} items - Belge listesi (oda bilgisi varsa roomNo/odaId vb.)
 * @param {Function} getRoomNo - (item) => roomNo
 * @returns {Object} { [roomNo]: items[] }
 */
export function groupDocumentsByRoom(items, getRoomNo = (item) => item.roomNo || item.odaNumarasi || item.oda_no || '—') {
  const groups = {};
  for (const item of items) {
    const key = getRoomNo(item) || 'Diğer';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

/**
 * Oda numarasına göre sıralı oda anahtarları
 */
export function sortRoomKeys(roomKeys) {
  const numeric = roomKeys.filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
  const rest = roomKeys.filter((k) => !/^\d+$/.test(k)).sort();
  return [...numeric.map(String), ...rest];
}
