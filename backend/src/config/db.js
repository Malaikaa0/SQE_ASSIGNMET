// Central PostgreSQL pool. Every query goes straight to the database —
// no query-result caching layer exists anywhere in this codebase, which is
// the implementation of Req 5615 (Real-time processing / live data).
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5000),
  database: process.env.PGDATABASE || 'library_admin_system',
  user: process.env.PGUSER || 'libraryuser',
  password: process.env.PGPASSWORD || 'library123',
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error', err);
});

module.exports = pool;
