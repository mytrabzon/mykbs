/**
 * Supabase server-side client (service_role).
 * Sadece backend'de kullanılır; mobilde ASLA bu key olmamalı.
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('[supabaseAdmin] SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik. KBS/checkin API çalışmaz.');
}

const supabaseAdmin = (supabaseUrl && serviceRoleKey)
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null;

module.exports = { supabaseAdmin };
