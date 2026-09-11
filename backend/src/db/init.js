/**
 * One-time provisioning script.
 *
 * Connects to PostgreSQL as a SUPERUSER (credentials supplied via
 * PGSUPERUSER / PGSUPERPASSWORD env vars, defaulting to "postgres"),
 * creates the `libraryuser` role and `library_admin_system` database if
 * they don't already exist, then applies schema.sql as libraryuser.
 *
 * Usage (PowerShell):
 *   $env:PGSUPERUSER="postgres"; $env:PGSUPERPASSWORD="<postgres-password>"; node src/db/init.js
 *
 * Usage (bash):
 *   PGSUPERUSER=postgres PGSUPERPASSWORD=<postgres-password> node src/db/init.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const HOST = process.env.PGHOST || '127.0.0.1';
const PORT = Number(process.env.PGPORT || 5000);
const APP_DB = process.env.PGDATABASE || 'library_admin_system';
const APP_USER = process.env.PGUSER || 'libraryuser';
const APP_PASSWORD = process.env.PGPASSWORD || 'library123';

const SUPER_USER = process.env.PGSUPERUSER || 'postgres';
const SUPER_PASSWORD = process.env.PGSUPERPASSWORD;

async function main() {
  if (!SUPER_PASSWORD) {
    console.error('ERROR: set PGSUPERPASSWORD (and optionally PGSUPERUSER) env vars before running this script.');
    process.exit(1);
  }

  const admin = new Client({
    host: HOST,
    port: PORT,
    user: SUPER_USER,
    password: SUPER_PASSWORD,
    database: 'postgres',
  });
  await admin.connect();
  console.log(`Connected to postgres as ${SUPER_USER}@${HOST}:${PORT}`);

  const roleExists = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [APP_USER]);
  if (roleExists.rowCount === 0) {
    await admin.query(`CREATE ROLE ${APP_USER} LOGIN PASSWORD '${APP_PASSWORD.replace(/'/g, "''")}'`);
    console.log(`Created role ${APP_USER}`);
  } else {
    await admin.query(`ALTER ROLE ${APP_USER} WITH LOGIN PASSWORD '${APP_PASSWORD.replace(/'/g, "''")}'`);
    console.log(`Role ${APP_USER} already existed, password reset`);
  }

  const dbExists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [APP_DB]);
  if (dbExists.rowCount === 0) {
    await admin.query(`CREATE DATABASE ${APP_DB} OWNER ${APP_USER}`);
    console.log(`Created database ${APP_DB}`);
  } else {
    console.log(`Database ${APP_DB} already exists`);
  }
  await admin.query(`GRANT ALL PRIVILEGES ON DATABASE ${APP_DB} TO ${APP_USER}`);
  await admin.end();

  // PostgreSQL 15+ revokes CREATE on the "public" schema from non-owners by
  // default, so even with DB-level GRANTs the app user can't create tables
  // until we hand over (or grant on) the public schema explicitly.
  const adminOnAppDb = new Client({ host: HOST, port: PORT, user: SUPER_USER, password: SUPER_PASSWORD, database: APP_DB });
  await adminOnAppDb.connect();
  await adminOnAppDb.query(`ALTER SCHEMA public OWNER TO ${APP_USER}`);
  await adminOnAppDb.query(`GRANT ALL ON SCHEMA public TO ${APP_USER}`);
  await adminOnAppDb.end();
  console.log(`Granted schema "public" ownership to ${APP_USER}`);

  // Apply schema as the app user so it owns every object (needed for GRANT-free operation).
  const appClient = new Client({
    host: HOST,
    port: PORT,
    user: APP_USER,
    password: APP_PASSWORD,
    database: APP_DB,
  });
  await appClient.connect();
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await appClient.query(schemaSql);
  console.log('Schema applied successfully.');
  await appClient.end();

  console.log('\nDone. Next run: npm run db:seed');
}

main().catch((err) => {
  console.error('Provisioning failed:', err.message);
  process.exit(1);
});
