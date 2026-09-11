import { useEffect, useState } from 'react';
import { api } from '../api';
import Feedback from '../components/Feedback.jsx';

export default function Monitoring() {
  const [metrics, setMetrics] = useState(null);
  const [thresholds, setThresholds] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [msg, setMsg] = useState(null);
  const [edits, setEdits] = useState({});

  async function loadAll() {
    const [live, alertData] = await Promise.all([api('/monitoring/live'), api('/monitoring/alerts')]);
    setMetrics(live);
    setThresholds(live.thresholds);
    setAlerts(alertData);
  }
  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 8000);
    return () => clearInterval(id);
  }, []);

  function edit(id, field, value) {
    setEdits((e) => ({ ...e, [id]: { ...e[id], [field]: value } }));
  }

  async function saveThreshold(t) {
    setMsg(null);
    const patch = edits[t.id] || {};
    try {
      await api(`/monitoring/thresholds/${t.id}`, { method: 'PUT', body: patch });
      setMsg({ type: 'success', text: `Threshold for ${t.metric_name} updated.` });
      loadAll();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  async function acknowledge(a) {
    setMsg(null);
    try {
      await api(`/monitoring/alerts/${a.id}/acknowledge`, { method: 'POST' });
      loadAll();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  return (
    <div>
      <h2>System Monitoring &amp; Alerts <span className="req-tag">SRS Req 6501</span></h2>
      <p className="muted">Live system resource monitoring with configurable warning/critical thresholds. Critical alerts are shown on the dashboard and emailed (or logged, if SMTP isn't configured).</p>
      <Feedback type={msg?.type} message={msg?.text} />

      <div className="panel">
        <h3>Live Metrics {metrics && <span className="muted">(sampled {new Date(metrics.sampled_at).toLocaleTimeString()}, refreshes every 8s)</span>}</h3>
        {metrics && (
          <div className="metric-grid">
            {Object.entries(metrics.metrics).map(([name, value]) => (
              <div className="metric-card" key={name}>
                <div className="name">{name.replaceAll('_', ' ')}</div>
                <div className="value">{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Alert Thresholds</h3>
        <table>
          <thead><tr><th>Metric</th><th>Warning</th><th>Critical</th><th>Direction</th><th>Email on critical</th><th></th></tr></thead>
          <tbody>
            {thresholds.map((t) => (
              <tr key={t.id}>
                <td>{t.metric_name}</td>
                <td>
                  <input style={{ width: 90 }} type="number" defaultValue={t.warning_threshold} onChange={(e) => edit(t.id, 'warning_threshold', Number(e.target.value))} />
                </td>
                <td>
                  <input style={{ width: 90 }} type="number" defaultValue={t.critical_threshold} onChange={(e) => edit(t.id, 'critical_threshold', Number(e.target.value))} />
                </td>
                <td className="muted">{t.higher_is_worse ? 'higher = worse' : 'lower = worse'}</td>
                <td>
                  <input type="checkbox" defaultChecked={t.email_on_critical} onChange={(e) => edit(t.id, 'email_on_critical', e.target.checked)} />
                </td>
                <td><button className="btn btn-sm secondary" onClick={() => saveThreshold(t)}>Save</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Alert History</h3>
        {alerts.length === 0 && <p className="muted">No alerts recorded yet.</p>}
        <table>
          <thead><tr><th>Level</th><th>Message</th><th>Emailed</th><th>Time</th><th></th></tr></thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id}>
                <td><span className={`badge ${a.level === 'CRITICAL' ? 'bad' : 'warn'}`}>{a.level}</span></td>
                <td>{a.message}</td>
                <td>{a.emailed ? 'Yes' : 'No'}</td>
                <td>{new Date(a.created_at).toLocaleString()}</td>
                <td>{a.acknowledged
                  ? <span className="badge ok">Acknowledged</span>
                  : <button className="btn btn-sm secondary" onClick={() => acknowledge(a)}>Acknowledge</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
