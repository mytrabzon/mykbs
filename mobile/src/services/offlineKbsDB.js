/**
 * Offline-first KBS kuyruğu: Her okuma anında lokal SQLite'a yazılır.
 * İnternet gelse de gelmese de kayıt kaybolmaz; sync worker senkronize eder.
 */
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'kbsprime_offline.db';
const TABLE = 'kbs_queue';
const MAX_RETRY = 10;

let db = null;

async function getDb() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      misafir_data TEXT NOT NULL,
      oda_no TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_kbs_queue_sync_status ON ${TABLE}(sync_status);
    CREATE INDEX IF NOT EXISTS idx_kbs_queue_created_at ON ${TABLE}(created_at);
  `);
  return db;
}

/**
 * Okuma anında hemen lokal kaydet. İnternet yoksa bile kayıt güvende.
 * @param {{ ad, soyad, kimlikNo?, pasaportNo?, dogumTarihi, uyruk, room_number }} misafirData - Check-in payload
 * @param {string} odaNo - Oda numarası
 * @param {string} branchId - Şube id (Supabase branch_id)
 * @returns {Promise<string>} local_id
 */
export async function saveToQueue(misafirData, odaNo, branchId) {
  const database = await getDb();
  const id = `${Date.now()}_${(misafirData.kimlikNo || misafirData.pasaportNo || Math.random().toString(36)).slice(0, 20)}`;
  const payload = JSON.stringify({
    ad: misafirData.ad,
    soyad: misafirData.soyad,
    kimlikNo: misafirData.kimlikNo || null,
    pasaportNo: misafirData.pasaportNo || null,
    dogumTarihi: misafirData.dogumTarihi || null,
    uyruk: misafirData.uyruk || 'TÜRK',
    room_number: odaNo || misafirData.room_number || ''
  });
  const stmt = await database.prepareAsync(
    `INSERT OR REPLACE INTO ${TABLE} (id, branch_id, misafir_data, oda_no, created_at, sync_status, retry_count) VALUES (?, ?, ?, ?, ?, 'pending', 0)`
  );
  await stmt.executeAsync(id, branchId, payload, String(odaNo || ''), Date.now());
  await stmt.finalizeAsync();
  return id;
}

/**
 * Senkronizasyon için bekleyen kayıtlar (en eski önce).
 */
export async function getPendingQueue(limit = 100) {
  const database = await getDb();
  const stmt = await database.prepareAsync(
    `SELECT id, branch_id, misafir_data, oda_no, created_at, retry_count, last_error FROM ${TABLE} WHERE sync_status = 'pending' AND retry_count < ? ORDER BY created_at ASC LIMIT ?`
  );
  try {
    const result = await stmt.executeAsync(MAX_RETRY, limit);
    const rows = await result.getAllAsync();
    return (rows || []).map((r) => ({
      id: r.id,
      branch_id: r.branch_id,
      misafir_data: typeof r.misafir_data === 'string' ? JSON.parse(r.misafir_data) : r.misafir_data,
      oda_no: r.oda_no,
      created_at: r.created_at,
      retry_count: r.retry_count,
      last_error: r.last_error
    }));
  } finally {
    await stmt.finalizeAsync();
  }
}

/**
 * Hata almış veya max retry aşılmış kayıtlar.
 */
export async function getFailedQueue() {
  const database = await getDb();
  const stmt = await database.prepareAsync(
    `SELECT id, branch_id, misafir_data, oda_no, created_at, retry_count, last_error FROM ${TABLE} WHERE sync_status = 'error' OR retry_count >= ? ORDER BY created_at DESC`
  );
  try {
    const result = await stmt.executeAsync(MAX_RETRY);
    const rows = await result.getAllAsync();
    return (rows || []).map((r) => ({
      id: r.id,
      branch_id: r.branch_id,
      misafir_data: typeof r.misafir_data === 'string' ? JSON.parse(r.misafir_data) : r.misafir_data,
      oda_no: r.oda_no,
      created_at: r.created_at,
      retry_count: r.retry_count,
      last_error: r.last_error
    }));
  } finally {
    await stmt.finalizeAsync();
  }
}

/**
 * Başarıyla gönderildi → kuyruktan sil.
 */
export async function deleteFromQueue(id) {
  const database = await getDb();
  const stmt = await database.prepareAsync(`DELETE FROM ${TABLE} WHERE id = ?`);
  await stmt.executeAsync(id);
  await stmt.finalizeAsync();
}

/**
 * Başarısız; retry sayısını artır, gerekirse error işaretle.
 */
export async function markFailed(id, errorMessage) {
  const database = await getDb();
  const stmt = await database.prepareAsync(
    `UPDATE ${TABLE} SET retry_count = retry_count + 1, last_error = ?, sync_status = CASE WHEN (retry_count + 1) >= ? THEN 'error' ELSE 'pending' END WHERE id = ?`
  );
  await stmt.executeAsync(errorMessage || 'Bilinmeyen hata', MAX_RETRY, id);
  await stmt.finalizeAsync();
}

/**
 * İstatistik: bekleyen ve hatalı sayıları.
 */
export async function getQueueStats() {
  const database = await getDb();
  const pendingStmt = await database.prepareAsync(`SELECT COUNT(*) as c FROM ${TABLE} WHERE sync_status = 'pending' AND retry_count < ?`);
  let pending = 0;
  let failed = 0;
  try {
    const pendingResult = await pendingStmt.executeAsync(MAX_RETRY);
    const pendingRows = await pendingResult.getAllAsync();
    if (pendingRows && pendingRows[0]) pending = pendingRows[0].c ?? 0;
  } finally {
    await pendingStmt.finalizeAsync();
  }
  const failedStmt = await database.prepareAsync(`SELECT COUNT(*) as c FROM ${TABLE} WHERE sync_status = 'error' OR retry_count >= ?`);
  try {
    const failedResult = await failedStmt.executeAsync(MAX_RETRY);
    const failedRows = await failedResult.getAllAsync();
    if (failedRows && failedRows[0]) failed = failedRows[0].c ?? 0;
  } finally {
    await failedStmt.finalizeAsync();
  }
  return { pending, failed };
}

/**
 * Başarısız kaydı tekrar "pending" yap (manuel tekrar dene).
 */
export async function resetToPending(id) {
  const database = await getDb();
  const stmt = await database.prepareAsync(
    `UPDATE ${TABLE} SET sync_status = 'pending', retry_count = 0, last_error = NULL WHERE id = ?`
  );
  await stmt.executeAsync(id);
  await stmt.finalizeAsync();
}
