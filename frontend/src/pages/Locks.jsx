import { useEffect, useState } from 'react';
import { api } from '../api';
import Feedback from '../components/Feedback.jsx';

export default function Locks() {
  const [locks, setLocks] = useState([]);
  const [timeout_, setTimeout_] = useState(15);
  const [msg, setMsg] = useState(null);
  const [lockForm, setLockForm] = useState({ record_type: 'BIB', record_id: '', location: 'MAIN' });

  async function loadAll() {
    const [l, s] = await Promise.all([api('/locks'), api('/locks/settings')]);
    setLocks(l);
    setTimeout_(s.default_lock_timeout_minutes);
  }
  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 8000); // live view (Req 5615) — also surfaces auto-expiry
    return () => clearInterval(id);
  }, []);

  async function acquireLock(e) {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/locks', { method: 'POST', body: { ...lockForm, record_id: Number(lockForm.record_id) } });
      setMsg({ type: 'success', text: `Lock acquired on ${lockForm.record_type} #${lockForm.record_id}.` });
      loadAll();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  async function unlock(l) {
    const reason = window.prompt(`Reason for force-unlocking ${l.record_type} #${l.record_id}?`, 'Released by administrator');
    if (reason === null) return;
    setMsg(null);
    try {
      await api(`/locks/${l.id}/unlock`, { method: 'POST', body: { reason } });
      setMsg({ type: 'success', text: `Record ${l.record_type} #${l.record_id} unlocked.` });
      loadAll();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  async function saveTimeout(e) {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/locks/settings', { method: 'PUT', body: { default_lock_timeout_minutes: Number(timeout_) } });
      setMsg({ type: 'success', text: `Default lock timeout updated to ${timeout_} minutes.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  function timeRemaining(l) {
    const expires = new Date(l.locked_at).getTime() + l.timeout_minutes * 60000;
    const ms = expires - Date.now();
    if (ms <= 0) return 'expiring...';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }

  return (
    <div>
      <h2>Record Lock Management <span className="req-tag">SRS Req 6513 / 7302</span></h2>
      <p className="muted">View which records are locked (location, user, time), with a configurable lock timeout and the ability to force-unlock.</p>
      <Feedback type={msg?.type} message={msg?.text} />

      <div className="grid-2">
        <div className="panel">
          <h3>Lock Timeout Setting</h3>
          <form onSubmit={saveTimeout}>
            <label>Default lock timeout (minutes)</label>
            <input type="number" min="1" value={timeout_} onChange={(e) => setTimeout_(e.target.value)} />
            <button className="btn" type="submit">Save</button>
          </form>
        </div>

        <div className="panel">
          <h3>Simulate Acquiring a Lock</h3>
          <form onSubmit={acquireLock}>
            <label>Record type</label>
            <select value={lockForm.record_type} onChange={(e) => setLockForm({ ...lockForm, record_type: e.target.value })}>
              <option value="BIB">Bibliographic record</option>
              <option value="ITEM">Item</option>
              <option value="PATRON">Patron</option>
              <option value="STAFF">Staff account</option>
            </select>
            <label>Record ID</label>
            <input type="number" value={lockForm.record_id} onChange={(e) => setLockForm({ ...lockForm, record_id: e.target.value })} required />
            <label>Location</label>
            <input value={lockForm.location} onChange={(e) => setLockForm({ ...lockForm, location: e.target.value })} />
            <button className="btn" type="submit">Acquire lock</button>
          </form>
        </div>
      </div>

      <div className="panel">
        <h3>Currently Locked Records</h3>
        {locks.length === 0 && <p className="muted">No records are currently locked.</p>}
        <table>
          <thead><tr><th>Record</th><th>Locked By</th><th>Location</th><th>Locked At</th><th>Expires In</th><th></th></tr></thead>
          <tbody>
            {locks.map((l) => (
              <tr key={l.id}>
                <td>{l.record_type} #{l.record_id}</td>
                <td>{l.locked_by_name} ({l.locked_by_username})</td>
                <td>{l.location}</td>
                <td>{new Date(l.locked_at).toLocaleString()}</td>
                <td>{timeRemaining(l)}</td>
                <td><button className="btn btn-sm danger" onClick={() => unlock(l)}>Force unlock</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
