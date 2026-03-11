/**
 * KBS offline kuyruk senkronizasyon worker'ı.
 * Periyodik olarak bekleyen kayıtları backend /api/checkin/batch ile gönderir.
 * İsteğe bağlı: @react-native-community/netinfo eklenirse internet gelince de sync tetiklenir.
 */
import { getBackendUrl, getToken } from './apiSupabase';
import * as offlineKbs from './offlineKbsDB';
import { logger } from '../utils/logger';

const BATCH_SIZE = 50;
const SYNC_INTERVAL_MS = 30 * 1000; // 30 saniye
let intervalId = null;
let isSyncing = false;

/**
 * Bekleyen kuyruğu backend'e gönder. Başarılı olanları kuyruktan siler, başarısızları markFailed yapar.
 */
export async function sync() {
  if (isSyncing) return;
  const backendUrl = getBackendUrl();
  const token = await getToken();
  if (!backendUrl || !token) return;

  const pending = await offlineKbs.getPendingQueue(BATCH_SIZE);
  if (pending.length === 0) return;

  isSyncing = true;
  try {
    const notifications = pending.map((item) => ({
      local_id: item.id,
      ad: item.misafir_data.ad,
      soyad: item.misafir_data.soyad,
      kimlikNo: item.misafir_data.kimlikNo || undefined,
      pasaportNo: item.misafir_data.pasaportNo || undefined,
      dogumTarihi: item.misafir_data.dogumTarihi || undefined,
      uyruk: item.misafir_data.uyruk || 'TÜRK',
      room_number: item.oda_no || item.misafir_data.room_number || ''
    }));

    logger.log('[KBS Sync] Sending batch', { count: notifications.length });

    const r = await fetch(`${backendUrl}/api/checkin/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ notifications })
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      const errMsg = data.message || `HTTP ${r.status}`;
      logger.warn('[KBS Sync] Batch failed', { status: r.status, message: errMsg });
      for (const item of pending) {
        await offlineKbs.markFailed(item.id, errMsg);
      }
      return;
    }

    const details = data.details || { success: [], failed: [] };
    for (const s of details.success || []) {
      if (s.local_id) await offlineKbs.deleteFromQueue(s.local_id);
    }
    for (const f of details.failed || []) {
      if (f.local_id) await offlineKbs.markFailed(f.local_id, f.error || 'Sunucu hata döndü');
    }

    logger.log('[KBS Sync] Batch done', {
      success: (details.success || []).length,
      failed: (details.failed || []).length
    });
  } catch (err) {
    logger.error('[KBS Sync] Error', err);
    for (const item of pending) {
      await offlineKbs.markFailed(item.id, err.message || 'Bağlantı hatası');
    }
  } finally {
    isSyncing = false;
  }
}

/**
 * Worker'ı başlat: uygulama açılışında bir sync, her 30 sn'de bir sync.
 */
export function start() {
  if (intervalId) return;

  sync().catch(() => {});
  intervalId = setInterval(() => {
    sync().catch(() => {});
  }, SYNC_INTERVAL_MS);

  logger.log('[KBS Sync] Worker started');
}

/**
 * Worker'ı durdur.
 */
export function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.log('[KBS Sync] Worker stopped');
  }
}
