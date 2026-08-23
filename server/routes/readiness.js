const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/ping', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  return res.status(ready ? 200 : 503).json({
    ok: ready,
    database: ready ? 'ready' : 'unavailable',
    ts: Date.now(),
  });
});

module.exports = router;
