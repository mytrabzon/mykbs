/**
 * POST /internal/kbs/worker — Railway cron (her 1 dk) veya manuel.
 * Header: x-worker-secret: <WORKER_SECRET>
 */
const express = require('express');
const { run } = require('../../worker/kbsOutboxWorker');

const router = express.Router();
const WORKER_SECRET = process.env.WORKER_SECRET;

router.post('/kbs/worker', (req, res) => {
  const secret = req.headers['x-worker-secret'];
  if (!WORKER_SECRET || secret !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  run()
    .then(() => res.json({ ok: true, message: 'Worker run completed' }))
    .catch((err) => {
      console.error('[internal/kbs/worker]', err);
      res.status(500).json({ error: err.message });
    });
});

module.exports = router;
