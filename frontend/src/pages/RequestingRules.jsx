import { useEffect, useState } from 'react';
import { api } from '../api';
import Feedback from '../components/Feedback.jsx';

const PATRON_TYPES = ['ANY', 'ADULT', 'JUVENILE', 'STUDENT', 'STAFF'];
const ITEM_STATUSES = ['LOST', 'WITHDRAWN', 'DAMAGED', 'IN_REPAIR', 'CHECKED_OUT', 'AVAILABLE'];

const emptyRule = {
  name: '', patron_type: 'ADULT', max_active_holds: 5, max_account_balance: 10,
  blocked_item_statuses: ['LOST', 'WITHDRAWN'], allow_staff_override: true, priority: 100, active: true,
};

export default function RequestingRules() {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(emptyRule);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState(null);

  const [patrons, setPatrons] = useState([]);
  const [bibs, setBibs] = useState([]);
  const [evalForm, setEvalForm] = useState({ patron_id: '', bib_id: '', staff_override: false, override_reason: '' });
  const [evalResult, setEvalResult] = useState(null);

  async function loadRules() { setRules(await api('/requesting-rules')); }
  async function loadTestData() {
    setPatrons(await api('/records/patrons'));
    setBibs(await api('/records/bib-records'));
  }
  useEffect(() => { loadRules(); loadTestData(); }, []);

  function toggleStatus(status) {
    setForm((f) => ({
      ...f,
      blocked_item_statuses: f.blocked_item_statuses.includes(status)
        ? f.blocked_item_statuses.filter((s) => s !== status)
        : [...f.blocked_item_statuses, status],
    }));
  }

  async function submitRule(e) {
    e.preventDefault();
    setMsg(null);
    try {
      if (editingId) {
        await api(`/requesting-rules/${editingId}`, { method: 'PUT', body: form });
        setMsg({ type: 'success', text: `Requesting rule "${form.name}" updated successfully.` });
      } else {
        await api('/requesting-rules', { method: 'POST', body: form });
        setMsg({ type: 'success', text: `Requesting rule "${form.name}" created successfully.` });
      }
      setForm(emptyRule);
      setEditingId(null);
      loadRules();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  function editRule(rule) { setEditingId(rule.id); setForm({ ...rule }); setMsg(null); }

  async function deleteRule(id) {
    setMsg(null);
    try {
      await api(`/requesting-rules/${id}`, { method: 'DELETE' });
      setMsg({ type: 'success', text: 'Requesting rule deleted.' });
      loadRules();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  async function runEval(e) {
    e.preventDefault();
    setEvalResult(null);
    try {
      const result = await api('/requesting-rules/evaluate', {
        method: 'POST',
        body: {
          patron_id: Number(evalForm.patron_id),
          bib_id: Number(evalForm.bib_id),
          staff_override: evalForm.staff_override,
          override_reason: evalForm.override_reason,
        },
      });
      setEvalResult(result);
    } catch (err) {
      setEvalResult({ eligible: false, reason: err.message, isError: true });
    }
  }

  return (
    <div>
      <h2>Requesting Rules <span className="req-tag">SRS Req 5190</span></h2>
      <p className="muted">Determine whether a patron can place a hold, based on patron type, current holds, and account balance / item status, with staff override.</p>

      <div className="panel">
        <h3>Hold Eligibility Tester</h3>
        <form onSubmit={runEval} className="grid-2">
          <div>
            <label>Patron</label>
            <select value={evalForm.patron_id} onChange={(e) => setEvalForm({ ...evalForm, patron_id: e.target.value })} required>
              <option value="">Select patron...</option>
              {patrons.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.patron_type}, balance ${p.account_balance})</option>)}
            </select>
          </div>
          <div>
            <label>Bibliographic record</label>
            <select value={evalForm.bib_id} onChange={(e) => setEvalForm({ ...evalForm, bib_id: e.target.value })} required>
              <option value="">Select title...</option>
              {bibs.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </div>
          <div>
            <label><input type="checkbox" checked={evalForm.staff_override} onChange={(e) => setEvalForm({ ...evalForm, staff_override: e.target.checked })} /> Staff override (bypass failed checks)</label>
          </div>
          {evalForm.staff_override && (
            <div>
              <label>Override reason (required, logged for audit)</label>
              <input value={evalForm.override_reason} onChange={(e) => setEvalForm({ ...evalForm, override_reason: e.target.value })} />
            </div>
          )}
          <div><button className="btn" type="submit">Check eligibility</button></div>
        </form>
        {evalResult && (
          <Feedback
            type={evalResult.isError ? 'error' : evalResult.eligible ? 'success' : 'warn'}
            message={
              evalResult.eligible
                ? evalResult.overridden
                  ? `HOLD PLACED VIA STAFF OVERRIDE — rule "${evalResult.rule_applied}" would normally have failed: ${evalResult.failed_checks.join(' ')} ${evalResult.note}`
                  : `ELIGIBLE — hold placed under rule "${evalResult.rule_applied}". Patron now has ${evalResult.current_active_holds} active hold(s).`
                : `NOT ELIGIBLE${evalResult.failed_checks ? ' — ' + evalResult.failed_checks.join(' ') : ': ' + (evalResult.reason || '')}`
            }
          />
        )}
      </div>

      <div className="panel">
        <h3>{editingId ? 'Edit Requesting Rule' : 'Create Requesting Rule'}</h3>
        <Feedback type={msg?.type} message={msg?.text} />
        <form onSubmit={submitRule}>
          <div className="grid-2">
            <div>
              <label>Rule name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label>Priority (lower = evaluated first)</label>
              <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
            </div>
            <div>
              <label>Patron type</label>
              <select value={form.patron_type} onChange={(e) => setForm({ ...form, patron_type: e.target.value })}>
                {PATRON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label>Max active holds</label>
              <input type="number" min="0" value={form.max_active_holds} onChange={(e) => setForm({ ...form, max_active_holds: Number(e.target.value) })} />
            </div>
            <div>
              <label>Max account balance allowed ($)</label>
              <input type="number" min="0" step="0.01" value={form.max_account_balance} onChange={(e) => setForm({ ...form, max_account_balance: Number(e.target.value) })} />
            </div>
          </div>

          <label>Item statuses that block a hold</label>
          <div className="privs">
            {ITEM_STATUSES.map((s) => (
              <label key={s}>
                <input type="checkbox" checked={form.blocked_item_statuses.includes(s)} onChange={() => toggleStatus(s)} />
                {s}
              </label>
            ))}
          </div>

          <label><input type="checkbox" checked={form.allow_staff_override} onChange={(e) => setForm({ ...form, allow_staff_override: e.target.checked })} /> Allow staff override</label>
          <label><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>

          <button className="btn" type="submit">{editingId ? 'Save changes' : 'Create rule'}</button>
          {editingId && <button type="button" className="btn secondary" style={{ marginLeft: 8 }} onClick={() => { setEditingId(null); setForm(emptyRule); }}>Cancel</button>}
        </form>
      </div>

      <div className="panel">
        <h3>Existing Requesting Rules</h3>
        <table>
          <thead>
            <tr><th>Priority</th><th>Name</th><th>Patron</th><th>Max Holds</th><th>Max Balance</th><th>Override?</th><th>Active</th><th></th></tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.priority}</td>
                <td>{r.name}</td>
                <td>{r.patron_type}</td>
                <td>{r.max_active_holds}</td>
                <td>${Number(r.max_account_balance).toFixed(2)}</td>
                <td>{r.allow_staff_override ? 'Yes' : 'No'}</td>
                <td><span className={`badge ${r.active ? 'ok' : 'neutral'}`}>{r.active ? 'Active' : 'Inactive'}</span></td>
                <td className="row-actions">
                  <button className="btn btn-sm secondary" onClick={() => editRule(r)}>Edit</button>
                  <button className="btn btn-sm danger" onClick={() => deleteRule(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
