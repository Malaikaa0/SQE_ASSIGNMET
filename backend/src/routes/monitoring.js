// SRS Req 6501 - System monitoring & alerts: dashboard endpoints.
const express = require('express');
const pool = require('../config/db');
const { requireAuth, requirePrivilege } = require('../middleware/auth');
const { collectMetrics } = require('../services/monitorService');

const router = express.Router();

// Live snapshot, computed fresh on every call (Req 5615).
router.get('/live', requireAuth, async (req, res) => {
  try {
    const metrics = await collectMetrics();
    const thresholds = await pool.query('SELECT * FROM monitoring_thresholds ORDER BY metric_name');
    res.json({ metrics, thresholds: thresholds.rows, sampled_at: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sample system metrics.' });
  }
});

router.get('/history/:metric', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT value, recorded_at FROM metric_readings WHERE metric_name = $1 ORDER BY recorded_at DESC LIMIT 50`,
    [req.params.metric]
  );
  res.json(result.rows.reverse());
});

router.get('/thresholds', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM monitoring_thresholds ORDER BY metric_name');
  res.json(result.rows);
});

router.put('/thresholds/:id', requireAuth, requirePrivilege('manageMonitoring'), async (req, res) => {
  const { warning_threshold, critical_threshold, email_on_critical, active } = req.body || {};
  try {
    const result = await pool.query(
      `UPDATE monitoring_thresholds SET
         warning_threshold = COALESCE($1, warning_threshold),
         critical_threshold = COALESCE($2, critical_threshold),
         email_on_critical = COALESCE($3, email_on_critical),
         active = COALESCE($4, active),
         updated_at = now()
       WHERE id = $5 RETURNING *`,
      [warning_threshold, critical_threshold, email_on_critical, active, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Threshold not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update threshold.' });
  }
});

router.get('/alerts', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 100');
  res.json(result.rows);
});

router.post('/alerts/:id/acknowledge', requireAuth, async (req, res) => {
  const result = await pool.query(
    `UPDATE alerts SET acknowledged = true, acknowledged_by = $1 WHERE id = $2 RETURNING *`,
    [req.staff.id, req.params.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Alert not found.' });
  res.json(result.rows[0]);
});

module.exports = router;
