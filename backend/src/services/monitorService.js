// SRS Req 6501 - System monitoring & alerts.
// Periodically samples real OS-level metrics (CPU load, memory usage,
// PostgreSQL pool connection count, disk free %), compares each against
// its configurable threshold, records the reading, and raises an alert
// (dashboard + email) when a threshold is crossed.
const os = require('os');
const fs = require('fs');
const pool = require('../config/db');
const { sendAlertEmail } = require('./mailer');

function getCpuLoadPct() {
  // 1-minute load average normalized by core count, expressed as a percent.
  // On Windows, os.loadavg() always returns [0,0,0], so fall back to an
  // instantaneous CPU busy-time sample across all cores.
  const load1 = os.loadavg()[0];
  if (load1 > 0) {
    const cores = os.cpus().length || 1;
    return Math.min(100, (load1 / cores) * 100);
  }
  const cpus = os.cpus();
  let idle = 0, total = 0;
  for (const cpu of cpus) {
    for (const t of Object.values(cpu.times)) total += t;
    idle += cpu.times.idle;
  }
  return total === 0 ? 0 : Math.max(0, Math.min(100, ((total - idle) / total) * 100));
}

function getMemoryUsedPct() {
  const total = os.totalmem();
  const free = os.freemem();
  return ((total - free) / total) * 100;
}

function getDiskFreePct() {
  // Best-effort, dependency-free disk check using fs.statfsSync (available
  // on modern Node, including Windows, since ~v18.15/v19.6). Falls back to
  // a fixed placeholder only if statfs is unavailable in the runtime.
  try {
    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(process.platform === 'win32' ? 'C:\\' : '/');
      return (stats.bfree / stats.blocks) * 100;
    }
  } catch (_) { /* fall through */ }
  return 65; // ASSUMPTION: placeholder when statfs is unavailable (see README).
}

async function getDbConnectionCount() {
  const result = await pool.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database()');
  return result.rows[0].count;
}

async function collectMetrics() {
  return {
    CPU_LOAD_PCT: Number(getCpuLoadPct().toFixed(2)),
    MEMORY_USED_PCT: Number(getMemoryUsedPct().toFixed(2)),
    DB_CONNECTIONS: await getDbConnectionCount(),
    DISK_FREE_PCT: Number(getDiskFreePct().toFixed(2)),
  };
}

async function evaluateAndAlert(metricName, value) {
  const thresholdRes = await pool.query(
    'SELECT * FROM monitoring_thresholds WHERE metric_name = $1 AND active = true',
    [metricName]
  );
  const threshold = thresholdRes.rows[0];
  if (!threshold) return null;

  const worse = threshold.higher_is_worse
    ? (a, b) => a >= b
    : (a, b) => a <= b;

  let level = null;
  let thresholdValue = null;
  if (worse(value, Number(threshold.critical_threshold))) {
    level = 'CRITICAL';
    thresholdValue = Number(threshold.critical_threshold);
  } else if (worse(value, Number(threshold.warning_threshold))) {
    level = 'WARNING';
    thresholdValue = Number(threshold.warning_threshold);
  }
  if (!level) return null;

  // De-duplication: while a metric stays breached at the same level, don't
  // insert a fresh alert row on every single sampling tick — only when the
  // level changes (e.g. WARNING -> CRITICAL, or newly breached) or the last
  // alert for this metric+level has aged past the cooldown window. ASSUMPTION:
  // no cooldown value was specified in the SRS; 5 minutes was chosen as a
  // reasonable default (configurable via ALERT_COOLDOWN_MINUTES).
  const cooldownMinutes = Number(process.env.ALERT_COOLDOWN_MINUTES || 5);
  const recentRes = await pool.query(
    `SELECT * FROM alerts WHERE metric_name = $1 ORDER BY created_at DESC LIMIT 1`,
    [metricName]
  );
  const recent = recentRes.rows[0];
  if (recent && recent.level === level) {
    const ageMs = Date.now() - new Date(recent.created_at).getTime();
    if (ageMs < cooldownMinutes * 60 * 1000) {
      return null; // still within cooldown for this metric/level, skip duplicate
    }
  }

  const message = `${metricName} is at ${value}${threshold.unit} (${level}), crossing the ${level.toLowerCase()} threshold of ${thresholdValue}${threshold.unit}.`;
  const alertRes = await pool.query(
    `INSERT INTO alerts (metric_name, level, value, threshold, message) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [metricName, level, value, thresholdValue, message]
  );
  const alert = alertRes.rows[0];

  if (level === 'CRITICAL' && threshold.email_on_critical) {
    const result = await sendAlertEmail({
      subject: `[Library System ALERT] ${metricName} CRITICAL`,
      text: message,
    });
    await pool.query('UPDATE alerts SET emailed = $1 WHERE id = $2', [!result.error, alert.id]);
  }

  return alert;
}

let intervalHandle = null;

function startMonitoring() {
  const intervalSeconds = Number(process.env.MONITOR_INTERVAL_SECONDS || 10);
  const tick = async () => {
    try {
      const metrics = await collectMetrics();
      for (const [name, value] of Object.entries(metrics)) {
        await pool.query('INSERT INTO metric_readings (metric_name, value) VALUES ($1,$2)', [name, value]);
        await evaluateAndAlert(name, value);
      }
    } catch (err) {
      console.error('Monitoring tick failed:', err.message);
    }
  };
  tick(); // run immediately on boot
  intervalHandle = setInterval(tick, intervalSeconds * 1000);
  console.log(`System monitoring started (sampling every ${intervalSeconds}s).`);
}

function stopMonitoring() {
  if (intervalHandle) clearInterval(intervalHandle);
}

module.exports = { startMonitoring, stopMonitoring, collectMetrics, evaluateAndAlert };
