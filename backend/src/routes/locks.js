// SRS Req 6513 + 7302 - Record lock management.
// View which records are locked (location, user, time), configurable lock
// timeout, and the ability for staff to force-unlock a record.
const express = require('express');
const pool = require('../config/db');
const { requireAuth, requirePrivilege } = require('../middleware/auth');

const router = express.Router();

async function getDefaultTimeoutMinutes() {
  const res = await pool.query(`SELECT value FROM system_settings WHERE key = 'default_lock_timeout_minutes'`);
  return res.rowCount ? Number(res.rows[0].value) : Number(process.env.DEFAULT_LOCK_TIMEOUT_MINUTES || 15);
}

// Auto-expiry: a lock is considered active only if unlocked_at IS NULL AND
// it hasn't exceeded its own timeout_minutes. We lazily flip expired locks
// to "unlocked_at = expiry time" on every read so the view is always live
// (Req 5615) instead of relying on a background sweep.
async function expireStaleLocks() {
  await pool.query(`
    UPDATE record_locks
    SET unlocked_at = locked_at + (timeout_minutes || ' minutes')::interval, unlock_reason = 'Auto-expired (timeout reached)'
    WHERE unlocked_at IS NULL AND now() > locked_at + (timeout_minutes || ' minutes')::interval
  `);
}

router.get('/', requireAuth, async (req, res) => {
  await expireStaleLocks();
  const result = await pool.query(
    `SELECT l.*, sa.username AS locked_by_username, sa.full_name AS locked_by_name
     FROM record_locks l JOIN staff_accounts sa ON sa.id = l.locked_by
     WHERE l.unlocked_at IS NULL
     ORDER BY l.locked_at DESC`
  );
  res.json(result.rows);
});

router.get('/settings', requireAuth, async (req, res) => {
  res.json({ default_lock_timeout_minutes: await getDefaultTimeoutMinutes() });
});

router.put('/settings', requireAuth, requirePrivilege('manageLocks'), async (req, res) => {
  const { default_lock_timeout_minutes } = req.body || {};
  const minutes = Number(default_lock_timeout_minutes);
  if (!minutes || minutes <= 0) {
    return res.status(400).json({ error: 'default_lock_timeout_minutes must be a positive number.' });
  }
  await pool.query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ('default_lock_timeout_minutes', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [String(minutes)]
  );
  res.json({ success: true, default_lock_timeout_minutes: minutes });
});

// Acquire a lock on a record. Fails with 409 if it's already actively locked
// by someone else.
router.post('/', requireAuth, async (req, res) => {
  const { record_type, record_id, location, timeout_minutes } = req.body || {};
  if (!record_type || !record_id) {
    return res.status(400).json({ error: 'record_type and record_id are required.' });
  }
  try {
    await expireStaleLocks();
    const existing = await pool.query(
      `SELECT l.*, sa.username AS locked_by_username FROM record_locks l
       JOIN staff_accounts sa ON sa.id = l.locked_by
       WHERE l.record_type = $1 AND l.record_id = $2 AND l.unlocked_at IS NULL`,
      [record_type, record_id]
    );
    if (existing.rowCount > 0) {
      const lock = existing.rows[0];
      return res.status(409).json({
        error: `Record is already locked by ${lock.locked_by_username} since ${new Date(lock.locked_at).toLocaleString()}.`,
        lock,
      });
    }

    const minutes = timeout_minutes || (await getDefaultTimeoutMinutes());
    const result = await pool.query(
      `INSERT INTO record_locks (record_type, record_id, locked_by, location, timeout_minutes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [record_type, record_id, req.staff.id, location || req.staff.location, minutes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to acquire lock.' });
  }
});

// Force-unlock (requires manageLocks privilege).
router.post('/:id/unlock', requireAuth, requirePrivilege('manageLocks'), async (req, res) => {
  const { reason } = req.body || {};
  try {
    const result = await pool.query(
      `UPDATE record_locks SET unlocked_at = now(), unlocked_by = $1, unlock_reason = $2
       WHERE id = $3 AND unlocked_at IS NULL RETURNING *`,
      [req.staff.id, reason || 'Manually unlocked by staff', req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Active lock not found (it may have already expired or been unlocked).' });
    res.json({ success: true, message: 'Record unlocked.', lock: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to unlock record.' });
  }
});

module.exports = router;
