// SRS Req 2420 - Staff account setup: create staff accounts with role
// templates and granular privileges. Passwords are always bcrypt-hashed
// (Req 6510).
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requirePrivilege, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/role-templates', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM role_templates ORDER BY id');
  res.json(result.rows);
});

router.post('/role-templates', requirePrivilege('manageStaff'), async (req, res) => {
  const { name, description = '', default_privileges = {} } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required.' });
  try {
    const result = await pool.query(
      `INSERT INTO role_templates (name, description, default_privileges) VALUES ($1,$2,$3) RETURNING *`,
      [name, description, default_privileges]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A role template with this name already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create role template.' });
  }
});

router.get('/', requirePrivilege('manageStaff'), async (req, res) => {
  const result = await pool.query(
    `SELECT sa.id, sa.username, sa.full_name, sa.email, sa.workgroup, sa.location, sa.active,
            sa.privileges, sa.created_at, rt.name AS role_template_name
     FROM staff_accounts sa LEFT JOIN role_templates rt ON rt.id = sa.role_template_id
     ORDER BY sa.id`
  );
  res.json(result.rows);
});

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,30}$/;

router.post('/', requirePrivilege('manageStaff'), async (req, res) => {
  const {
    username, password, full_name, email = null,
    workgroup = 'DEFAULT', location = 'MAIN',
    role_template_id = null, privilege_overrides = {},
  } = req.body || {};

  if (!username || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'username must be 3-30 characters: letters, numbers, dot, underscore, hyphen.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters.' });
  }
  if (!full_name) return res.status(400).json({ error: 'full_name is required.' });

  try {
    let basePrivileges = {};
    if (role_template_id) {
      const templateRes = await pool.query('SELECT * FROM role_templates WHERE id = $1', [role_template_id]);
      if (templateRes.rowCount === 0) return res.status(404).json({ error: 'Role template not found.' });
      basePrivileges = templateRes.rows[0].default_privileges;
    }
    // Granular privileges: start from the role template's defaults, then
    // apply any explicit per-account overrides (e.g. grant one extra
    // privilege to a specific staff member without a whole new template).
    const finalPrivileges = { ...basePrivileges, ...privilege_overrides };

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO staff_accounts (username, password_hash, full_name, email, workgroup, location, role_template_id, privileges)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, username, full_name, email, workgroup, location, role_template_id, privileges, active, created_at`,
      [username, passwordHash, full_name, email, workgroup, location, role_template_id, finalPrivileges]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A staff account with this username already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create staff account.' });
  }
});

router.put('/:id', requirePrivilege('manageStaff'), async (req, res) => {
  const { full_name, email, workgroup, location, active, privilege_overrides } = req.body || {};
  try {
    let privileges = undefined;
    if (privilege_overrides) {
      const current = await pool.query('SELECT privileges FROM staff_accounts WHERE id = $1', [req.params.id]);
      if (current.rowCount === 0) return res.status(404).json({ error: 'Staff account not found.' });
      privileges = { ...current.rows[0].privileges, ...privilege_overrides };
    }
    const result = await pool.query(
      `UPDATE staff_accounts SET
         full_name = COALESCE($1, full_name),
         email = COALESCE($2, email),
         workgroup = COALESCE($3, workgroup),
         location = COALESCE($4, location),
         active = COALESCE($5, active),
         privileges = COALESCE($6, privileges)
       WHERE id = $7
       RETURNING id, username, full_name, email, workgroup, location, role_template_id, privileges, active, created_at`,
      [full_name, email, workgroup, location, active, privileges, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Staff account not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update staff account.' });
  }
});

router.post('/:id/reset-password', requirePrivilege('manageStaff'), async (req, res) => {
  const { new_password } = req.body || {};
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'new_password must be at least 8 characters.' });
  }
  const passwordHash = await bcrypt.hash(new_password, 10);
  const result = await pool.query(
    'UPDATE staff_accounts SET password_hash = $1 WHERE id = $2 RETURNING id, username',
    [passwordHash, req.params.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Staff account not found.' });
  res.json({ success: true, message: `Password reset for ${result.rows[0].username}.` });
});

module.exports = router;
