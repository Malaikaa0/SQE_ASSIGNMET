/**
 * Seeds sample data so every feature can be exercised immediately after setup:
 * role templates, a staff login, patrons, bib/item records, loan & requesting
 * rules, monitoring thresholds, and system settings (Req defaults documented
 * in README "Assumptions").
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ---- Role templates (Req 2420) ----
    const roleTemplates = [
      {
        name: 'Administrator',
        description: 'Full system access including staff and system administration.',
        privileges: {
          manageStaff: true, manageLoanRules: true, manageRequestingRules: true,
          deleteRecords: true, manageSuppression: true, manageLocks: true,
          viewMonitoring: true, manageMonitoring: true, overrideHolds: true,
        },
      },
      {
        name: 'Circulation Supervisor',
        description: 'Manages circulation policy and can override holds/loans.',
        privileges: {
          manageStaff: false, manageLoanRules: true, manageRequestingRules: true,
          deleteRecords: true, manageSuppression: false, manageLocks: true,
          viewMonitoring: true, manageMonitoring: false, overrideHolds: true,
        },
      },
      {
        name: 'Cataloger',
        description: 'Manages bibliographic/item records and suppression.',
        privileges: {
          manageStaff: false, manageLoanRules: false, manageRequestingRules: false,
          deleteRecords: true, manageSuppression: true, manageLocks: true,
          viewMonitoring: false, manageMonitoring: false, overrideHolds: false,
        },
      },
      {
        name: 'Reference Staff',
        description: 'Read-only / limited front-line staff access.',
        privileges: {
          manageStaff: false, manageLoanRules: false, manageRequestingRules: false,
          deleteRecords: false, manageSuppression: false, manageLocks: false,
          viewMonitoring: false, manageMonitoring: false, overrideHolds: false,
        },
      },
    ];

    const roleIds = {};
    for (const rt of roleTemplates) {
      const res = await client.query(
        `INSERT INTO role_templates (name, description, default_privileges)
         VALUES ($1,$2,$3)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, default_privileges = EXCLUDED.default_privileges
         RETURNING id`,
        [rt.name, rt.description, rt.privileges]
      );
      roleIds[rt.name] = res.rows[0].id;
    }

    // ---- Staff accounts ----
    const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
    await client.query(
      `INSERT INTO staff_accounts (username, password_hash, full_name, email, workgroup, location, role_template_id, privileges, active)
       VALUES ('admin', $1, 'System Administrator', 'admin@library.local', 'ADMIN', 'MAIN', $2, $3, true)
       ON CONFLICT (username) DO NOTHING`,
      [adminPasswordHash, roleIds['Administrator'], roleTemplates[0].privileges]
    );

    const circPasswordHash = await bcrypt.hash('Circ123!', 10);
    await client.query(
      `INSERT INTO staff_accounts (username, password_hash, full_name, email, workgroup, location, role_template_id, privileges, active)
       VALUES ('circsuper', $1, 'Casey Circulation', 'circ@library.local', 'CIRC', 'MAIN', $2, $3, true)
       ON CONFLICT (username) DO NOTHING`,
      [circPasswordHash, roleIds['Circulation Supervisor'], roleTemplates[1].privileges]
    );

    const catPasswordHash = await bcrypt.hash('Cat123!', 10);
    await client.query(
      `INSERT INTO staff_accounts (username, password_hash, full_name, email, workgroup, location, role_template_id, privileges, active)
       VALUES ('cataloger', $1, 'Cat Aloger', 'cat@library.local', 'CATALOGING', 'BRANCH_A', $2, $3, true)
       ON CONFLICT (username) DO NOTHING`,
      [catPasswordHash, roleIds['Cataloger'], roleTemplates[2].privileges]
    );

    // ---- Patrons ----
    const patrons = [
      ['Alice Adult', 'ADULT', 0.00],
      ['Jamie Juvenile', 'JUVENILE', 2.50],
      ['Sam Student', 'STUDENT', 15.00],
      ['Pat Patron (over limit)', 'ADULT', 55.00],
    ];
    const patronIds = [];
    for (const [name, type, bal] of patrons) {
      const res = await client.query(
        `INSERT INTO patrons (name, patron_type, account_balance) VALUES ($1,$2,$3) RETURNING id`,
        [name, type, bal]
      );
      patronIds.push(res.rows[0].id);
    }

    // ---- Bib + item records ----
    const bibs = [
      ['The Pragmatic Programmer', 'Hunt & Thomas', 'MAIN'],
      ['Clean Code', 'Robert C. Martin', 'MAIN'],
      ['Library Science Quarterly', 'Various', 'BRANCH_A'],
    ];
    const bibIds = [];
    for (const [title, author, location] of bibs) {
      const res = await client.query(
        `INSERT INTO bib_records (title, author, location) VALUES ($1,$2,$3) RETURNING id`,
        [title, author, location]
      );
      bibIds.push(res.rows[0].id);
    }

    const items = [
      ['BC-0001', bibIds[0], 'BOOK', 'AVAILABLE', 'MAIN'],
      ['BC-0002', bibIds[0], 'BOOK', 'CHECKED_OUT', 'MAIN'],
      ['BC-0003', bibIds[1], 'BOOK', 'AVAILABLE', 'MAIN'],
      ['BC-0004', bibIds[1], 'BOOK', 'DAMAGED', 'MAIN'],
      ['BC-0005', bibIds[2], 'BOOK', 'AVAILABLE', 'BRANCH_A'],
    ];
    const itemIds = [];
    for (const [barcode, bibId, itemType, status, location] of items) {
      const res = await client.query(
        `INSERT INTO items (barcode, bib_id, item_type, status, location) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [barcode, bibId, itemType, status, location]
      );
      itemIds.push(res.rows[0].id);
    }

    // A live checkout so deletion-restriction + loan rule demos have real data
    await client.query(
      `INSERT INTO checkouts (item_id, patron_id, due_date) VALUES ($1, $2, now() + interval '21 days')`,
      [itemIds[1], patronIds[0]]
    );

    // A live hold so bib deletion-restriction demo has real data
    await client.query(
      `INSERT INTO holds (patron_id, bib_id, item_id, status) VALUES ($1, $2, $3, 'ACTIVE')`,
      [patronIds[1], bibIds[1], null]
    );

    // ---- Loan rules (Req 5057) ----
    await client.query(`DELETE FROM loan_rules`);
    await client.query(
      `INSERT INTO loan_rules (name, patron_type, item_type, max_items_checked_out, loan_period_days, renewal_limit, blocked_item_statuses, priority)
       VALUES
       ('Adult standard', 'ADULT', 'ANY', 15, 21, 2, ARRAY['LOST','DAMAGED','IN_REPAIR','WITHDRAWN'], 10),
       ('Juvenile standard', 'JUVENILE', 'ANY', 8, 14, 1, ARRAY['LOST','DAMAGED','IN_REPAIR','WITHDRAWN'], 10),
       ('Student standard', 'STUDENT', 'ANY', 10, 28, 3, ARRAY['LOST','DAMAGED','IN_REPAIR','WITHDRAWN'], 10),
       ('Default fallback', 'ANY', 'ANY', 5, 14, 1, ARRAY['LOST','DAMAGED','IN_REPAIR','WITHDRAWN'], 999)`
    );

    // ---- Requesting rules (Req 5190) ----
    await client.query(`DELETE FROM requesting_rules`);
    await client.query(
      `INSERT INTO requesting_rules (name, patron_type, max_active_holds, max_account_balance, blocked_item_statuses, allow_staff_override, priority)
       VALUES
       ('Adult standard holds', 'ADULT', 10, 50.00, ARRAY['LOST','WITHDRAWN'], true, 10),
       ('Juvenile standard holds', 'JUVENILE', 5, 20.00, ARRAY['LOST','WITHDRAWN'], true, 10),
       ('Student standard holds', 'STUDENT', 8, 30.00, ARRAY['LOST','WITHDRAWN'], true, 10),
       ('Default fallback holds', 'ANY', 3, 10.00, ARRAY['LOST','WITHDRAWN'], true, 999)`
    );

    // ---- System settings (lock timeout default, Req 6513) ----
    await client.query(
      `INSERT INTO system_settings (key, value) VALUES ('default_lock_timeout_minutes', '15')
       ON CONFLICT (key) DO NOTHING`
    );

    // ---- Monitoring thresholds (Req 6501) ----
    await client.query(`DELETE FROM monitoring_thresholds`);
    await client.query(
      `INSERT INTO monitoring_thresholds (metric_name, unit, warning_threshold, critical_threshold, higher_is_worse, email_on_critical)
       VALUES
       ('CPU_LOAD_PCT', '%', 70, 90, true, true),
       ('MEMORY_USED_PCT', '%', 75, 90, true, true),
       ('DB_CONNECTIONS', 'count', 15, 25, true, true),
       ('DISK_FREE_PCT', '%', 20, 10, false, true)`
    );

    await client.query('COMMIT');
    console.log('Seed data inserted successfully.');
    console.log('Login: admin / Admin123!  (also: circsuper / Circ123!, cataloger / Cat123!)');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
