// SRS Req 5190 - Requesting rules: determine whether a patron can place a
// hold based on patron type, current holds, account balance, and item
// status, with a staff-override escape hatch that is always logged.
const express = require('express');
const pool = require('../config/db');
const { requirePrivilege, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM requesting_rules ORDER BY priority ASC, id ASC');
  res.json(result.rows);
});

router.post('/', requirePrivilege('manageRequestingRules'), async (req, res) => {
  const {
    name, patron_type, max_active_holds = 5, max_account_balance = 10.0,
    blocked_item_statuses = ['LOST', 'WITHDRAWN'], allow_staff_override = true,
    priority = 100, active = true,
  } = req.body || {};

  if (!name || !patron_type) {
    return res.status(400).json({ error: 'name and patron_type are required.' });
  }
  if (max_active_holds < 0 || max_account_balance < 0) {
    return res.status(400).json({ error: 'max_active_holds and max_account_balance cannot be negative.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO requesting_rules (name, patron_type, max_active_holds, max_account_balance, blocked_item_statuses, allow_staff_override, priority, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, patron_type, max_active_holds, max_account_balance, blocked_item_statuses, allow_staff_override, priority, active]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create requesting rule.' });
  }
});

router.put('/:id', requirePrivilege('manageRequestingRules'), async (req, res) => {
  const { id } = req.params;
  const {
    name, patron_type, max_active_holds, max_account_balance,
    blocked_item_statuses, allow_staff_override, priority, active,
  } = req.body || {};

  try {
    const result = await pool.query(
      `UPDATE requesting_rules SET
         name = COALESCE($1, name),
         patron_type = COALESCE($2, patron_type),
         max_active_holds = COALESCE($3, max_active_holds),
         max_account_balance = COALESCE($4, max_account_balance),
         blocked_item_statuses = COALESCE($5, blocked_item_statuses),
         allow_staff_override = COALESCE($6, allow_staff_override),
         priority = COALESCE($7, priority),
         active = COALESCE($8, active),
         updated_at = now()
       WHERE id = $9 RETURNING *`,
      [name, patron_type, max_active_holds, max_account_balance, blocked_item_statuses, allow_staff_override, priority, active, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Requesting rule not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update requesting rule.' });
  }
});

router.delete('/:id', requirePrivilege('manageRequestingRules'), async (req, res) => {
  const result = await pool.query('DELETE FROM requesting_rules WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Requesting rule not found.' });
  res.json({ success: true });
});

async function findMatchingRequestingRule(patronType) {
  const result = await pool.query(
    `SELECT *, (CASE WHEN patron_type = $1 THEN 0 ELSE 1 END) AS specificity
     FROM requesting_rules
     WHERE active = true AND (patron_type = $1 OR patron_type = 'ANY')
     ORDER BY specificity ASC, priority ASC
     LIMIT 1`,
    [patronType]
  );
  return result.rows[0] || null;
}

// Evaluate whether patron_id may place a hold on bib_id (optionally a
// specific item_id). staff_override=true bypasses failed checks but is
// only honored if the matched rule allows it and the caller is authenticated
// staff; the override is always persisted with a reason for audit.
router.post('/evaluate', requireAuth, async (req, res) => {
  const { patron_id, bib_id, item_id = null, staff_override = false, override_reason = null } = req.body || {};
  if (!patron_id || !bib_id) {
    return res.status(400).json({ error: 'patron_id and bib_id are required.' });
  }

  try {
    const patronRes = await pool.query('SELECT * FROM patrons WHERE id = $1', [patron_id]);
    const patron = patronRes.rows[0];
    if (!patron) return res.status(404).json({ error: 'Patron not found.' });

    const bibRes = await pool.query('SELECT * FROM bib_records WHERE id = $1', [bib_id]);
    if (bibRes.rowCount === 0) return res.status(404).json({ error: 'Bibliographic record not found.' });

    let item = null;
    if (item_id) {
      const itemRes = await pool.query('SELECT * FROM items WHERE id = $1', [item_id]);
      item = itemRes.rows[0];
      if (!item) return res.status(404).json({ error: 'Item not found.' });
    }

    const rule = await findMatchingRequestingRule(patron.patron_type);
    if (!rule) {
      return res.json({ eligible: false, reason: 'No active requesting rule matches this patron type.' });
    }

    const failures = [];
    if (!patron.active) failures.push('Patron account is inactive/blocked.');
    if (item && rule.blocked_item_statuses.includes(item.status)) {
      failures.push(`Item status "${item.status}" is not holdable under rule "${rule.name}".`);
    }
    if (Number(patron.account_balance) > Number(rule.max_account_balance)) {
      failures.push(`Account balance $${patron.account_balance} exceeds the allowed maximum of $${rule.max_account_balance}.`);
    }

    const holdsCountRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM holds WHERE patron_id = $1 AND status = 'ACTIVE'`,
      [patron_id]
    );
    const activeHolds = holdsCountRes.rows[0].count;
    if (activeHolds >= rule.max_active_holds) {
      failures.push(`Patron already has ${activeHolds} active hold(s), meeting/exceeding the limit of ${rule.max_active_holds}.`);
    }

    if (failures.length === 0) {
      const created = await pool.query(
        `INSERT INTO holds (patron_id, bib_id, item_id, status, staff_override, override_reason, created_by)
         VALUES ($1,$2,$3,'ACTIVE',false,NULL,$4) RETURNING *`,
        [patron_id, bib_id, item_id, req.staff.id]
      );
      return res.json({ eligible: true, rule_applied: rule.name, hold: created.rows[0], current_active_holds: activeHolds + 1 });
    }

    // Failed one or more checks.
    if (staff_override) {
      if (!rule.allow_staff_override) {
        return res.status(403).json({
          eligible: false,
          reason: `Rule "${rule.name}" does not permit staff override.`,
          failed_checks: failures,
        });
      }
      if (!override_reason || !override_reason.trim()) {
        return res.status(400).json({ error: 'A reason is required to record a staff override.' });
      }
      const created = await pool.query(
        `INSERT INTO holds (patron_id, bib_id, item_id, status, staff_override, override_reason, created_by)
         VALUES ($1,$2,$3,'ACTIVE',true,$4,$5) RETURNING *`,
        [patron_id, bib_id, item_id, override_reason, req.staff.id]
      );
      return res.json({
        eligible: true,
        overridden: true,
        rule_applied: rule.name,
        failed_checks: failures,
        hold: created.rows[0],
        note: `Hold placed via staff override by ${req.staff.username}. Reason: ${override_reason}`,
      });
    }

    return res.json({ eligible: false, rule_applied: rule.name, failed_checks: failures });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to evaluate requesting eligibility.' });
  }
});

module.exports = router;
