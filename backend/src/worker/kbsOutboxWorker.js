/**
 * KBS outbox worker: pending kayıtları alır, Polis/Jandarma API'ye gönderir.
 * Railway cron: POST /internal/kbs/worker (x-worker-secret) veya in-process setInterval.
 */
const { supabaseAdmin } = require('../lib/supabaseAdmin');
const { createKBSClient } = require('../services/kbs/kbsAdapter');
const { markSent, markFailed } = require('../repo/kbsOutboxRepo');

const BATCH_SIZE = 25;
const INTERVAL_MS = 60 * 1000; // 1 dakika
const MAX_TRIES = 10;
const BASE_DELAY_MINUTES = 5;

function getBackoffMinutes(tryCount) {
  return Math.min(BASE_DELAY_MINUTES * Math.pow(2, tryCount), 1440); // max 24h
}

async function processOne(row) {
  const { id, branch_id, type, payload, try_count } = row;
  if (!supabaseAdmin) return;

  const { data: branch } = await supabaseAdmin.from('branches').select('*').eq('id', branch_id).single();
  if (!branch) {
    await markFailed(id, 'Branch bulunamadı', new Date().toISOString(), try_count + 1);
    return;
  }

  const client = createKBSClient(branch);
  let result;

  try {
    if (type === 'checkin') {
      result = await client.sendCheckIn(payload);
    } else if (type === 'checkout') {
      result = await client.sendCheckOut(payload);
    } else if (type === 'room_change') {
      result = await client.sendRoomChange({
        kimlikNo: payload.kimlikNo,
        pasaportNo: payload.pasaportNo,
        eskiOda: payload.eskiOda,
        yeniOda: payload.yeniOda
      });
    } else {
      await markFailed(id, 'Bilinmeyen type: ' + type, new Date().toISOString(), try_count + 1);
      return;
    }
  } catch (err) {
    const nextTry = try_count + 1;
    const nextTryAt = new Date(Date.now() + getBackoffMinutes(nextTry) * 60 * 1000).toISOString();
    await markFailed(id, err.message, nextTryAt, nextTry);
    return;
  }

  if (result.success) {
    await markSent(id);
  } else {
    const nextTry = try_count + 1;
    const nextTryAt = new Date(Date.now() + getBackoffMinutes(nextTry) * 60 * 1000).toISOString();
    await markFailed(id, result.message || 'KBS hata', nextTryAt, nextTry);
  }
}

/** Tek kayıt gönderimi (checkin/checkout sonrası hemen deneme) */
async function attemptSendOutbox(id) {
  if (!supabaseAdmin) return;
  const { data: row, error } = await supabaseAdmin
    .from('kbs_outbox')
    .select('id, branch_id, type, payload, try_count')
    .eq('id', id)
    .single();
  if (error || !row) return;
  await processOne(row);
}

async function run() {
  if (!supabaseAdmin) return;

  const { data: rows, error } = await supabaseAdmin
    .from('kbs_outbox')
    .select('id, branch_id, type, payload, try_count')
    .eq('status', 'pending')
    .lte('next_try_at', new Date().toISOString())
    .order('next_try_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[KBS Worker] fetch error', error);
    return;
  }
  if (!rows || rows.length === 0) return;

  for (const row of rows) {
    await processOne(row);
  }
}

let intervalId = null;

function start() {
  if (intervalId) return;
  run();
  intervalId = setInterval(run, INTERVAL_MS);
  console.log('[KBS Worker] started, interval', INTERVAL_MS, 'ms');
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[KBS Worker] stopped');
  }
}

module.exports = { start, stop, run, attemptSendOutbox };
