// SRS Req 5278 - Suppression rules: control visibility of bib/item records.
// scope = WORKGROUP (visible only to staff logged into a specific workgroup),
// LOCATION (visible only to staff/patrons at a specific location), or ALL
// (fully suppressed - hidden from all staff and patrons everywhere).
// ASSUMPTION: "specific location" restricts visibility TO that location
// (mirroring "workgroup-only"), not away from it. See README assumptions.
const express = require('express');
const pool = require('../config/db');
const { requirePrivilege, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  const result = await pool.query(
    `SELECT s.*,
       CASE WHEN s.record_type = 'BIB' THEN b1.title ELSE b2.title END AS record_title
     FROM suppression_rules s
     LEFT JOIN bib_records b1 ON s.record_type = 'BIB' AND b1.id = s.record_id
     LEFT JOIN items i ON s.record_type = 'ITEM' AND i.id = s.record_id
     LEFT JOIN bib_records b2 ON i.bib_id = b2.id
     ORDER BY s.id DESC`
  );
  res.json(result.rows);
});

router.post('/', requireAuth, requirePrivilege('manageSuppression'), async (req, res) => {
  const { record_type, record_id, scope, workgroup = null, location = null, reason = null } = req.body || {};

  if (!['BIB', 'ITEM'].includes(record_type)) {
    return res.status(400).json({ error: 'record_type must be BIB or ITEM.' });
  }
  if (!['WORKGROUP', 'LOCATION', 'ALL'].includes(scope)) {
    return res.status(400).json({ error: 'scope must be WORKGROUP, LOCATION, or ALL.' });
  }
  if (scope === 'WORKGROUP' && !workgroup) {
    return res.status(400).json({ error: 'workgroup is required when scope is WORKGROUP.' });
  }
  if (scope === 'LOCATION' && !location) {
    return res.status(400).json({ error: 'location is required when scope is LOCATION.' });
  }
  if (!record_id) return res.status(400).json({ error: 'record_id is required.' });

  try {
    const table = record_type === 'BIB' ? 'bib_records' : 'items';
    const exists = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1`, [record_id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: `${record_type} record ${record_id} not found.` });

    const result = await pool.query(
      `INSERT INTO suppression_rules (record_type, record_id, scope, workgroup, location, reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (record_type, record_id) DO UPDATE SET
         scope = EXCLUDED.scope, workgroup = EXCLUDED.workgroup, location = EXCLUDED.location,
         reason = EXCLUDED.reason, created_by = EXCLUDED.created_by, created_at = now()
       RETURNING *`,
      [record_type, record_id, scope, workgroup, location, reason, req.staff.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create suppression rule.' });
  }
});

router.delete('/:id', requirePrivilege('manageSuppression'), async (req, res) => {
  const result = await pool.query('DELETE FROM suppression_rules WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Suppression rule not found.' });
  res.json({ success: true, message: 'Suppression rule removed; record visibility restored.' });
});

// Simulates the OPAC/staff-catalog visibility check: given a viewer context
// (isStaff, workgroup, location), returns whether a record would be visible.
router.post('/check-visibility', async (req, res) => {
  const { record_type, record_id, viewer_is_staff = false, viewer_workgroup = null, viewer_location = null } = req.body || {};
  try {
    const ruleRes = await pool.query(
      'SELECT * FROM suppression_rules WHERE record_type = $1 AND record_id = $2',
      [record_type, record_id]
    );
    const rule = ruleRes.rows[0];
    if (!rule) return res.json({ visible: true, reason: 'No suppression rule applies.' });

    if (rule.scope === 'ALL') {
      return res.json({ visible: false, reason: 'Record is suppressed from all staff and patrons.' });
    }
    if (rule.scope === 'WORKGROUP') {
      const visible = viewer_is_staff && viewer_workgroup === rule.workgroup;
      return res.json({
        visible,
        reason: visible
          ? `Visible: viewer is staff in workgroup "${rule.workgroup}".`
          : `Hidden: record is restricted to workgroup "${rule.workgroup}" staff only.`,
      });
    }
    if (rule.scope === 'LOCATION') {
      const visible = viewer_location === rule.location;
      return res.json({
        visible,
        reason: visible
          ? `Visible: viewer location "${viewer_location}" matches the restricted location "${rule.location}".`
          : `Hidden: record is restricted to location "${rule.location}" only.`,
      });
    }
    res.json({ visible: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check visibility.' });
  }
});

module.exports = router;
