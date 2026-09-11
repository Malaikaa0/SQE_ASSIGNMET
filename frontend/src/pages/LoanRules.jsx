import { useEffect, useState } from 'react';
import { api } from '../api';
import Feedback from '../components/Feedback.jsx';

const PATRON_TYPES = ['ANY', 'ADULT', 'JUVENILE', 'STUDENT', 'STAFF'];
const ITEM_TYPES = ['ANY', 'BOOK', 'DVD', 'EQUIPMENT', 'REFERENCE'];
const ITEM_STATUSES = ['LOST', 'DAMAGED', 'IN_REPAIR', 'WITHDRAWN', 'CHECKED_OUT', 'AVAILABLE'];

const emptyRule = {
  name: '', patron_type: 'ADULT', item_type: 'ANY', max_items_checked_out: 10,
  loan_period_days: 21, renewal_limit: 2, blocked_item_statuses: ['LOST', 'DAMAGED', 'IN_REPAIR', 'WITHDRAWN'],
  priority: 100, active: true,
};

export default function LoanRules() {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(emptyRule);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState(null);

  const [patrons, setPatrons] = useState([]);
  const [items, setItems] = useState([]);
  const [evalForm, setEvalForm] = useState({ patron_id: '', item_id: '' });
  const [evalResult, setEvalResult] = useState(null);

  async function loadRules() {
    setRules(await api('/loan-rules'));
  }
  async function loadTestData() {
    setPatrons(await api('/records/patrons'));
    setItems(await api('/records/items'));
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
        await api(`/loan-rules/${editingId}`, { method: 'PUT', body: form });
        setMsg({ type: 'success', text: `Loan rule "${form.name}" updated successfully.` });
      } else {
        await api('/loan-rules', { method: 'POST', body: form });
        setMsg({ type: 'success', text: `Loan rule "${form.name}" created successfully.` });
      }
      setForm(emptyRule);
      setEditingId(null);
      loadRules();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  function editRule(rule) {
    setEditingId(rule.id);
    setForm({ ...rule });
    setMsg(null);
  }

  async function deleteRule(id) {
    setMsg(null);
    try {
      await api(`/loan-rules/${id}`, { method: 'DELETE' });
      setMsg({ type: 'success', text: 'Loan rule deleted.' });
      loadRules();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  async function runEval(e) {
    e.preventDefault();
    setEvalResult(null);
    try {
      const result = await api('/loan-rules/evaluate', {
        method: 'POST',
        body: { patron_id: Number(evalForm.patron_id), item_id: Number(evalForm.item_id) },
      });
      setEvalResult(result);
    } catch (err) {
      setEvalResult({ eligible: false, reason: err.message, isError: true });
    }
  }

  return (
    <div>
      <h2>Loan Rules <span className="req-tag">SRS Req 5057</span></h2>
      <p className="muted">Determine checkout eligibility by patron type, item status, and current items checked out; calculate loan period and renewal limits.</p>

      <div className="panel">
        <h3>Checkout Eligibility Tester</h3>
        <form onSubmit={runEval} className="grid-2">
          <div>
            <label>Patron</label>
            <select value={evalForm.patron_id} onChange={(e) => setEvalForm({ ...evalForm, patron_id: e.target.value })} required>
              <option value="">Select patron...</option>
              {patrons.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.patron_type})</option>)}
            </select>
          </div>
          <div>
            <label>Item</label>
            <select value={evalForm.item_id} onChange={(e) => setEvalForm({ ...evalForm, item_id: e.target.value })} required>
              <option value="">Select item...</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.barcode} — {i.bib_title} ({i.status})</option>)}
            </select>
          </div>
          <div><button className="btn" type="submit">Check eligibility</button></div>
        </form>
        {evalResult && (
          <Feedback
            type={evalResult.isError ? 'error' : evalResult.eligible ? 'success' : 'warn'}
            message={
              evalResult.eligible
                ? `ELIGIBLE — rule "${evalResult.rule_applied}". Loan period: ${evalResult.loan_period_days} days, renewal limit: ${evalResult.renewal_limit}, due date: ${new Date(evalResult.due_date).toLocaleDateString()}. Currently has ${evalResult.current_items_checked_out}/${evalResult.max_items_checked_out} items checked out.`
                : `NOT ELIGIBLE — ${evalResult.reason}`
            }
          />
        )}
      </div>

      <div className="panel">
        <h3>{editingId ? 'Edit Loan Rule' : 'Create Loan Rule'}</h3>
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
              <label>Item type</label>
              <select value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })}>
                {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label>Max items checked out</label>
              <input type="number" min="1" value={form.max_items_checked_out} onChange={(e) => setForm({ ...form, max_items_checked_out: Number(e.target.value) })} />
            </div>
            <div>
              <label>Loan period (days)</label>
              <input type="number" min="1" value={form.loan_period_days} onChange={(e) => setForm({ ...form, loan_period_days: Number(e.target.value) })} />
            </div>
            <div>
              <label>Renewal limit</label>
              <input type="number" min="0" value={form.renewal_limit} onChange={(e) => setForm({ ...form, renewal_limit: Number(e.target.value) })} />
            </div>
          </div>

          <label>Item statuses that block checkout</label>
          <div className="privs">
            {ITEM_STATUSES.map((s) => (
              <label key={s}>
                <input type="checkbox" checked={form.blocked_item_statuses.includes(s)} onChange={() => toggleStatus(s)} />
                {s}
              </label>
            ))}
          </div>

          <label><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>

          <button className="btn" type="submit">{editingId ? 'Save changes' : 'Create rule'}</button>
          {editingId && <button type="button" className="btn secondary" style={{ marginLeft: 8 }} onClick={() => { setEditingId(null); setForm(emptyRule); }}>Cancel</button>}
        </form>
      </div>

      <div className="panel">
        <h3>Existing Loan Rules</h3>
        <table>
          <thead>
            <tr><th>Priority</th><th>Name</th><th>Patron</th><th>Item</th><th>Max Out</th><th>Loan Period</th><th>Renewals</th><th>Active</th><th></th></tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.priority}</td>
                <td>{r.name}</td>
                <td>{r.patron_type}</td>
                <td>{r.item_type}</td>
                <td>{r.max_items_checked_out}</td>
                <td>{r.loan_period_days}d</td>
                <td>{r.renewal_limit}</td>
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
