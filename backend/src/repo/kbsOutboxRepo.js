/**
 * KBS outbox repository: create, markSent, markFailed.
 * Payload JSONB; status pending|sent|failed; exponential backoff via next_try_at.
 */
const { supabaseAdmin } = require('../lib/supabaseAdmin');

async function createOutbox(branchId, type, payload) {
  if (!supabaseAdmin) throw new Error('Supabase admin not configured');
  const { data, error } = await supabaseAdmin
    .from('kbs_outbox')
    .insert({
      branch_id: branchId,
      type,
      payload: payload || {},
      status: 'pending',
      try_count: 0,
      next_try_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function markSent(id) {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin
    .from('kbs_outbox')
    .update({ status: 'sent', last_error: null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

async function markFailed(id, errorMessage, nextTryAt, tryCount) {
  if (!supabaseAdmin) return;
  await supabaseAdmin
    .from('kbs_outbox')
    .update({
      status: tryCount >= 10 ? 'failed' : 'pending',
      last_error: errorMessage,
      next_try_at: nextTryAt,
      try_count: tryCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
}

module.exports = { createOutbox, markSent, markFailed };
