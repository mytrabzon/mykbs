/**
 * Push token kaydı — backend JWT ile. Supabase Edge /push_register_token çağrılmaz.
 * Body: { expoPushToken, deviceId?, platform }
 */
const express = require('express');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const { supabaseAdmin } = require('../lib/supabaseAdmin');

const router = express.Router();

router.post('/register', authenticateTesisOrSupabase, async (req, res) => {
  try {
    const { expoPushToken, deviceId, platform } = req.body || {};
    if (!expoPushToken || !platform || !['ios', 'android'].includes(platform)) {
      return res.status(400).json({ message: 'expoPushToken ve platform (ios|android) gerekli' });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ message: 'Push kaydı yapılamıyor' });
    }

    let userIdentifier;
    if (req.authSource === 'supabase') {
      userIdentifier = `supabase:${req.user.id}`;
    } else {
      userIdentifier = `prisma:${req.user.id}`;
    }

    const { data: existing } = await supabaseAdmin
      .from('push_registrations')
      .select('id')
      .eq('user_identifier', userIdentifier)
      .eq('expo_push_token', expoPushToken)
      .maybeSingle();
    const payload = {
      user_identifier: userIdentifier,
      expo_push_token: expoPushToken,
      device_id: deviceId || null,
      platform,
      updated_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabaseAdmin.from('push_registrations').update(payload).eq('id', existing.id)
      : await supabaseAdmin.from('push_registrations').insert(payload);

    if (error) {
      console.error('[push/register]', error);
      return res.status(500).json({ message: 'Push kaydı yapılamadı', error: error.message });
    }
    res.json({ message: 'Push token kaydedildi' });
  } catch (err) {
    console.error('[push/register]', err);
    res.status(500).json({ message: 'Push kaydı hatası', error: err.message });
  }
});

module.exports = router;
