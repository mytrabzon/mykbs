const express = require('express');
const { supabase, supabaseAdmin } = require('../services/supabase');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * Supabase health check
 */
router.get('/health', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        message: 'Supabase not configured',
        configured: false 
      });
    }

    // Basit bir test sorgusu
    const { data, error } = await supabase
      .from('_prisma_migrations')
      .select('*')
      .limit(1);

    if (error) {
      return res.status(500).json({ 
        message: 'Supabase connection error',
        error: error.message 
      });
    }

    res.json({ 
      status: 'ok',
      supabase: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Supabase health check failed',
      error: error.message 
    });
  }
});

/**
 * Supabase realtime subscription test (örnek)
 */
router.get('/realtime', authenticate, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ message: 'Supabase not configured' });
    }

    // Realtime subscription örneği
    const channel = supabase
      .channel('test-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tesis' },
        (payload) => {
          console.log('Change received!', payload);
        }
      )
      .subscribe();

    res.json({ 
      message: 'Realtime subscription started',
      channel: channel.state 
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Realtime setup failed',
      error: error.message 
    });
  }
});

module.exports = router;

