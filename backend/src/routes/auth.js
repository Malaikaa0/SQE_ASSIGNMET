const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Req 6510: passwords are stored as bcrypt hashes only, never in plaintext.
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const result = await pool.query(
      `SELECT sa.*, rt.name AS role_template_name
       FROM staff_accounts sa
       LEFT JOIN role_templates rt ON rt.id = sa.role_template_id
       WHERE username = $1`,
      [username]
    );
    const account = result.rows[0];
    if (!account || !account.active) {
      return res.status(401).json({ error: 'Invalid credentials or inactive account.' });
    }
    const valid = await bcrypt.compare(password, account.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const payload = {
      id: account.id,
      username: account.username,
      fullName: account.full_name,
      workgroup: account.workgroup,
      location: account.location,
      roleTemplate: account.role_template_name,
      privileges: account.privileges,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    res.json({ token, staff: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed due to a server error.' });
  }
});

module.exports = router;
