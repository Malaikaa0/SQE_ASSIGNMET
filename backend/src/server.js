require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');

const noCache = require('./middleware/noCache');
const { requireAuth } = require('./middleware/auth');
const { ensureCert } = require('./utils/certs');
const { startMonitoring } = require('./services/monitorService');

const authRoutes = require('./routes/auth');
const loanRuleRoutes = require('./routes/loanRules');
const requestingRuleRoutes = require('./routes/requestingRules');
const recordRoutes = require('./routes/records');
const suppressionRoutes = require('./routes/suppression');
const lockRoutes = require('./routes/locks');
const monitoringRoutes = require('./routes/monitoring');
const staffRoutes = require('./routes/staff');

const app = express();
app.use(cors());
app.use(express.json());
app.use(noCache); // Req 5615: no caching, ever.

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Public
app.use('/api/auth', authRoutes);

// Everything below requires a valid session (Req 6510/6511: only
// authenticated, encrypted-transport requests can touch patron/system data).
app.use('/api/loan-rules', requireAuth, loanRuleRoutes);
app.use('/api/requesting-rules', requireAuth, requestingRuleRoutes);
app.use('/api/records', requireAuth, recordRoutes);
app.use('/api/suppression', requireAuth, suppressionRoutes);
app.use('/api/locks', lockRoutes); // requireAuth applied per-route internally
app.use('/api/monitoring', monitoringRoutes); // requireAuth applied per-route internally
app.use('/api/staff', requireAuth, staffRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

const HTTPS_PORT = Number(process.env.HTTPS_PORT || 8443);
const HTTP_PORT = Number(process.env.HTTP_PORT || 8080);

// Req 6510 / 6511: serve over TLS. A self-signed cert is generated
// automatically for local development if none is present.
const { key, cert } = ensureCert();
https.createServer({ key, cert }, app).listen(HTTPS_PORT, () => {
  console.log(`HTTPS API listening on https://localhost:${HTTPS_PORT}`);
});

if (process.env.ENABLE_HTTP_REDIRECT !== 'false') {
  http
    .createServer((req, res) => {
      const host = (req.headers.host || 'localhost').split(':')[0];
      res.writeHead(301, { Location: `https://${host}:${HTTPS_PORT}${req.url}` });
      res.end();
    })
    .listen(HTTP_PORT, () => {
      console.log(`HTTP on :${HTTP_PORT} permanently redirects to HTTPS (Req 6511: secure protocol enforced).`);
    });
}

startMonitoring();
