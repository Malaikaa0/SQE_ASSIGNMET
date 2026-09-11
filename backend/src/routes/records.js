// SRS Req 2445 - Business rules: deletion restrictions.
// Blocks deleting item records that are checked out, or bibliographic
// records that have existing (active) holds. Also exposes minimal CRUD for
// patrons/bib records/items/checkouts/holds so the other modules have real
// data to operate against.
const express = require('express');
const pool = require('../config/db');
const { requirePrivilege } = require('../middleware/auth');

const router = express.Router();

// ---- Patrons ----
router.get('/patrons', async (req, res) => {
  const result = await pool.query('SELECT * FROM patrons ORDER BY id');
  res.json(result.rows);
});

router.post('/patrons', async (req, res) => {
  const { name, patron_type = 'ADULT', account_balance = 0 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required.' });
  const result = await pool.query(
    'INSERT INTO patrons (name, patron_type, account_balance) VALUES ($1,$2,$3) RETURNING *',
    [name, patron_type, account_balance]
  );
  res.status(201).json(result.rows[0]);
});

// ---- Bib records ----
router.get('/bib-records', async (req, res) => {
  const result = await pool.query(
    `SELECT b.*,
       EXISTS(SELECT 1 FROM holds h WHERE h.bib_id = b.id AND h.status = 'ACTIVE') AS has_active_holds,
       (SELECT COUNT(*)::int FROM holds h WHERE h.bib_id = b.id AND h.status = 'ACTIVE') AS active_hold_count
     FROM bib_records b ORDER BY b.id`
  );
  res.json(result.rows);
});

router.post('/bib-records', async (req, res) => {
  const { title, author, location = 'MAIN' } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required.' });
  const result = await pool.query(
    'INSERT INTO bib_records (title, author, location) VALUES ($1,$2,$3) RETURNING *',
    [title, author, location]
  );
  res.status(201).json(result.rows[0]);
});

router.delete('/bib-records/:id', requirePrivilege('deleteRecords'), async (req, res) => {
  const { id } = req.params;
  try {
    const holdsRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM holds WHERE bib_id = $1 AND status = 'ACTIVE'`,
      [id]
    );
    const activeHolds = holdsRes.rows[0].count;
    if (activeHolds > 0) {
      return res.status(409).json({
        error: `Cannot delete bibliographic record: it has ${activeHolds} active hold(s). Cancel all holds first.`,
        blocked: true,
        active_holds: activeHolds,
      });
    }
    const result = await pool.query('DELETE FROM bib_records WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Bibliographic record not found.' });
    res.json({ success: true, message: 'Bibliographic record deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete bibliographic record.' });
  }
});

// ---- Items ----
router.get('/items', async (req, res) => {
  const result = await pool.query(
    `SELECT i.*, b.title AS bib_title,
       EXISTS(SELECT 1 FROM checkouts c WHERE c.item_id = i.id AND c.returned_at IS NULL) AS is_checked_out
     FROM items i JOIN bib_records b ON b.id = i.bib_id
     ORDER BY i.id`
  );
  res.json(result.rows);
});

router.post('/items', async (req, res) => {
  const { barcode, bib_id, item_type = 'BOOK', status = 'AVAILABLE', location = 'MAIN' } = req.body || {};
  if (!barcode || !bib_id) return res.status(400).json({ error: 'barcode and bib_id are required.' });
  try {
    const result = await pool.query(
      'INSERT INTO items (barcode, bib_id, item_type, status, location) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [barcode, bib_id, item_type, status, location]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'An item with this barcode already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create item.' });
  }
});

router.delete('/items/:id', requirePrivilege('deleteRecords'), async (req, res) => {
  const { id } = req.params;
  try {
    const checkoutRes = await pool.query(
      `SELECT c.*, p.name AS patron_name FROM checkouts c JOIN patrons p ON p.id = c.patron_id
       WHERE c.item_id = $1 AND c.returned_at IS NULL`,
      [id]
    );
    if (checkoutRes.rowCount > 0) {
      const co = checkoutRes.rows[0];
      return res.status(409).json({
        error: `Cannot delete item: it is currently checked out to ${co.patron_name} (due ${new Date(co.due_date).toLocaleDateString()}). Check the item in first.`,
        blocked: true,
      });
    }
    const result = await pool.query('DELETE FROM items WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Item not found.' });
    res.json({ success: true, message: 'Item deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete item.' });
  }
});

// ---- Checkouts / holds (support data for the demos above) ----
router.get('/checkouts', async (req, res) => {
  const result = await pool.query(
    `SELECT c.*, p.name AS patron_name, i.barcode FROM checkouts c
     JOIN patrons p ON p.id = c.patron_id JOIN items i ON i.id = c.item_id
     WHERE c.returned_at IS NULL ORDER BY c.id`
  );
  res.json(result.rows);
});

router.post('/checkouts/:id/return', async (req, res) => {
  const result = await pool.query(
    `UPDATE checkouts SET returned_at = now() WHERE id = $1 AND returned_at IS NULL RETURNING *`,
    [req.params.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Open checkout not found.' });
  await pool.query(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [result.rows[0].item_id]);
  res.json({ success: true, message: 'Item returned.' });
});

router.get('/holds', async (req, res) => {
  const result = await pool.query(
    `SELECT h.*, p.name AS patron_name, b.title AS bib_title FROM holds h
     JOIN patrons p ON p.id = h.patron_id JOIN bib_records b ON b.id = h.bib_id
     ORDER BY h.id`
  );
  res.json(result.rows);
});

router.post('/holds/:id/cancel', async (req, res) => {
  const result = await pool.query(
    `UPDATE holds SET status = 'CANCELLED' WHERE id = $1 AND status = 'ACTIVE' RETURNING *`,
    [req.params.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Active hold not found.' });
  res.json({ success: true, message: 'Hold cancelled.' });
});

module.exports = router;
