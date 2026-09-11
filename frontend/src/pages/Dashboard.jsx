import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Feedback from '../components/Feedback.jsx';

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [locks, setLocks] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [live, alertData, lockData] = await Promise.all([
        api('/monitoring/live'),
        api('/monitoring/alerts'),
        api('/locks'),
      ]);
      setMetrics(live);
      setAlerts(alertData.slice(0, 5));
      setLocks(lockData);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10000); // live refresh, no caching (Req 5615)
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>
      <p className="muted">Live overview — refreshes every 10 seconds directly from the database and OS, no caching (Req 5615).</p>
      <Feedback type="error" message={error} />

      <div className="panel">
        <h3>System Metrics {metrics && <span className="muted">(sampled {new Date(metrics.sampled_at).toLocaleTimeString()})</span>}</h3>
        {metrics ? (
          <div className="metric-grid">
            {Object.entries(metrics.metrics).map(([name, value]) => {
              const t = metrics.thresholds.find((th) => th.metric_name === name);
              let status = 'ok';
              if (t) {
                const worse = t.higher_is_worse ? (a, b) => a >= b : (a, b) => a <= b;
                if (worse(value, Number(t.critical_threshold))) status = 'bad';
                else if (worse(value, Number(t.warning_threshold))) status = 'warn';
              }
              return (
                <div className="metric-card" key={name}>
                  <div className="name">{name.replaceAll('_', ' ')}</div>
                  <div className="value">{value}{t ? t.unit : ''}</div>
                  <span className={`badge ${status}`}>{status === 'ok' ? 'Normal' : status === 'warn' ? 'Warning' : 'Critical'}</span>
                </div>
              );
            })}
          </div>
        ) : <p className="muted">Loading...</p>}
        <Link to="/monitoring" className="btn secondary btn-sm" style={{ marginTop: 16 }}>Manage thresholds &rarr;</Link>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>Recent Alerts</h3>
          {alerts.length === 0 && <p className="muted">No alerts recorded yet.</p>}
          {alerts.map((a) => (
            <div key={a.id} style={{ marginBottom: 8 }}>
              <span className={`badge ${a.level === 'CRITICAL' ? 'bad' : 'warn'}`}>{a.level}</span>{' '}
              <span style={{ fontSize: 13 }}>{a.message}</span>
            </div>
          ))}
          <Link to="/monitoring" className="btn secondary btn-sm" style={{ marginTop: 10 }}>View all &rarr;</Link>
        </div>

        <div className="panel">
          <h3>Active Record Locks</h3>
          {locks.length === 0 && <p className="muted">No records are currently locked.</p>}
          {locks.slice(0, 5).map((l) => (
            <div key={l.id} style={{ marginBottom: 8, fontSize: 13 }}>
              <strong>{l.record_type} #{l.record_id}</strong> locked by {l.locked_by_name} at {l.location} since{' '}
              {new Date(l.locked_at).toLocaleTimeString()}
            </div>
          ))}
          <Link to="/locks" className="btn secondary btn-sm" style={{ marginTop: 10 }}>Manage locks &rarr;</Link>
        </div>
      </div>

      <div className="panel">
        <h3>Modules</h3>
        <ul>
          <li><Link to="/loan-rules">Loan Rules</Link> — checkout eligibility, loan periods, renewal limits (Req 5057)</li>
          <li><Link to="/requesting-rules">Requesting Rules</Link> — hold eligibility with staff override (Req 5190)</li>
          <li><Link to="/records">Records &amp; Deletion Restrictions</Link> — patrons, bibs, items, checkouts, holds (Req 2445)</li>
          <li><Link to="/suppression">Suppression Rules</Link> — workgroup / location / global visibility control (Req 5278)</li>
          <li><Link to="/locks">Record Lock Management</Link> — view/unlock, configurable timeout (Req 6513 / 7302)</li>
          <li><Link to="/monitoring">System Monitoring &amp; Alerts</Link> — thresholds, dashboard + email alerts (Req 6501)</li>
          <li><Link to="/staff">Staff Account Setup</Link> — role templates &amp; granular privileges (Req 2420)</li>
        </ul>
      </div>
    </div>
  );
}
