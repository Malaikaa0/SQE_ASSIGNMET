// SRS Req 5057 - Loan rules: determine checkout eligibility and calculate
// loan period / renewal limits based on patron type, item status, and how
// many items the patron currently has checked out.
const express = require('express');
const pool = require('../config/db');
const { requirePrivilege } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM loan_rules ORDER BY priority ASC, id ASC');
  res.json(result.rows);
});

router.post('/', requirePrivilege('manageLoanRules'), async (req, res) => {
  const {
    name, patron_type, item_type = 'ANY', max_items_checked_out = 10,
    loan_period_days = 21, renewal_limit = 2,
    blocked_item_statuses = ['LOST', 'DAMAGED', 'IN_REPAIR', 'WITHDRAWN'],
    priority = 100, active = true,
  } = req.body || {};

  if (!name || !patron_type) {
    return res.status(400).json({ error: 'name and patron_type are required.' });
  }
  if (loan_period_days <= 0 || renewal_limit < 0 || max_items_checked_out <= 0) {
    return res.status(400).json({ error: 'loan_period_days and max_items_checked_out must be positive; renewal_limit cannot be negative.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO loan_rules (name, patron_type, item_type, max_items_checked_out, loan_period_days, renewal_limit, blocked_item_statuses, priority, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, patron_type, item_type, max_items_checked_out, loan_period_days, renewal_limit, blocked_item_statuses, priority, active]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create loan rule.' });
  }
});

router.put('/:id', requirePrivilege('manageLoanRules'), async (req, res) => {
  const { id } = req.params;
  const {
    name, patron_type, item_type, max_items_checked_out,
    loan_period_days, renewal_limit, blocked_item_statuses, priority, active,
  } = req.body || {};

  try {
    const result = await pool.query(
      `UPDATE loan_rules SET
         name = COALESCE($1, name),
         patron_type = COALESCE($2, patron_type),
         item_type = COALESCE($3, item_type),
         max_items_checked_out = COALESCE($4, max_items_checked_out),
         loan_period_days = COALESCE($5, loan_period_days),
         renewal_limit = COALESCE($6, renewal_limit),
         blocked_item_statuses = COALESCE($7, blocked_item_statuses),
         priority = COALESCE($8, priority),
         active = COALESCE($9, active),
         updated_at = now()
       WHERE id = $10 RETURNING *`,
      [name, patron_type, item_type, max_items_checked_out, loan_period_days, renewal_limit, blocked_item_statuses, priority, active, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Loan rule not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update loan rule.' });
  }
});

router.delete('/:id', requirePrivilege('manageLoanRules'), async (req, res) => {
  const result = await pool.query('DELETE FROM loan_rules WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Loan rule not found.' });
  res.json({ success: true });
});

// Picks the most specific ACTIVE matching rule: exact patron_type + exact
// item_type first, then exact patron_type + ANY item_type, then ANY/ANY,
// tie-broken by priority (lower wins).
async function findMatchingLoanRule(patronType, itemType) {
  const result = await pool.query(
    `SELECT *,
       (CASE WHEN patron_type = $1 THEN 0 ELSE 1 END) AS patron_specificity,
       (CASE WHEN item_type = $2 THEN 0 ELSE 1 END) AS item_specificity
     FROM loan_rules
     WHERE active = true AND (patron_type = $1 OR patron_type = 'ANY') AND (item_type = $2 OR item_type = 'ANY')
     ORDER BY patron_specificity ASC, item_specificity ASC, priority ASC
     LIMIT 1`,
    [patronType, itemType]
  );
  return result.rows[0] || null;
}

router.post('/evaluate', async (req, res) => {
  const { patron_id, item_id } = req.body || {};
  if (!patron_id || !item_id) {
    return res.status(400).json({ error: 'patron_id and item_id are required.' });
  }

  try {
    const patronRes = await pool.query('SELECT * FROM patrons WHERE id = $1', [patron_id]);
    const patron = patronRes.rows[0];
    if (!patron) return res.status(404).json({ error: 'Patron not found.' });
    if (!patron.active) {
      return res.json({ eligible: false, reason: 'Patron account is inactive/blocked.' });
    }

    const itemRes = await pool.query('SELECT * FROM items WHERE id = $1', [item_id]);
    const item = itemRes.rows[0];
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const rule = await findMatchingLoanRule(patron.patron_type, item.item_type);
    if (!rule) {
      return res.json({ eligible: false, reason: 'No active loan rule matches this patron type / item type combination.' });
    }

    if (rule.blocked_item_statuses.includes(item.status)) {
      return res.json({
        eligible: false,
        reason: `Item status "${item.status}" is not eligible for checkout under rule "${rule.name}".`,
        rule_applied: rule.name,
      });
    }
    if (item.status !== 'AVAILABLE') {
      return res.json({ eligible: false, reason: `Item is currently "${item.status}", not available.`, rule_applied: rule.name });
    }

    const currentCountRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM checkouts WHERE patron_id = $1 AND returned_at IS NULL`,
      [patron_id]
    );
    const currentlyCheckedOut = currentCountRes.rows[0].count;

    if (currentlyCheckedOut >= rule.max_items_checked_out) {
      return res.json({
        eligible: false,
        reason: `Patron already has ${currentlyCheckedOut} item(s) checked out, which meets/exceeds the limit of ${rule.max_items_checked_out} under rule "${rule.name}".`,
        rule_applied: rule.name,
        current_items_checked_out: currentlyCheckedOut,
      });
    }

    const dueDate = new Date(Date.now() + rule.loan_period_days * 24 * 60 * 60 * 1000);

    res.json({
      eligible: true,
      rule_applied: rule.name,
      loan_period_days: rule.loan_period_days,
      renewal_limit: rule.renewal_limit,
      due_date: dueDate.toISOString(),
      current_items_checked_out: currentlyCheckedOut,
      max_items_checked_out: rule.max_items_checked_out,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to evaluate loan eligibility.' });
  }
});

module.exports = router;
