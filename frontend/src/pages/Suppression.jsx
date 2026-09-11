import { useEffect, useState } from 'react';
import { api, getStaff } from '../api';
import Feedback from '../components/Feedback.jsx';

export default function Suppression() {
  const staff = getStaff();
  const [rules, setRules] = useState([]);
  const [bibs, setBibs] = useState([]);
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState(null);

  const [form, setForm] = useState({ record_type: 'BIB', record_id: '', scope: 'WORKGROUP', workgroup: staff?.workgroup || '', location: staff?.location || '', reason: '' });
  const [checkForm, setCheckForm] = useState({ record_type: 'BIB', record_id: '', viewer_is_staff: true, viewer_workgroup: '', viewer_location: '' });
  const [checkResult, setCheckResult] = useState(null);

  async function loadAll() {
    const [r, b, i] = await Promise.all([api('/suppression'), api('/records/bib-records'), api('/records/items')]);
    setRules(r); setBibs(b); setItems(i);
  }
  useEffect(() => { loadAll(); }, []);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/suppression', { method: 'POST', body: { ...form, record_id: Number(form.record_id) } });
      setMsg({ type: 'success', text: 'Suppression rule applied. The record is now hidden according to the selected scope.' });
      loadAll();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  async function remove(id) {
    setMsg(null);
    try {
      await api(`/suppression/${id}`, { method: 'DELETE' });
      setMsg({ type: 'success', text: 'Suppression removed; record visibility restored.' });
      loadAll();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function runCheck(e) {
    e.preventDefault();
    setCheckResult(null);
    try {
      const result = await api('/suppression/check-visibility', { method: 'POST', body: { ...checkForm, record_id: Number(checkForm.record_id) } });
      setCheckResult(result);
    } catch (err) {
      setCheckResult({ visible: false, reason: err.message, isError: true });
    }
  }

  const recordOptions = form.record_type === 'BIB' ? bibs.map(b => ({ id: b.id, label: b.title })) : items.map(i => ({ id: i.id, label: `${i.barcode} (${i.bib_title})` }));
  const checkRecordOptions = checkForm.record_type === 'BIB' ? bibs.map(b => ({ id: b.id, label: b.title })) : items.map(i => ({ id: i.id, label: `${i.barcode} (${i.bib_title})` }));

  return (
    <div>
      <h2>Suppression Rules <span className="req-tag">SRS Req 5278</span></h2>
      <p className="muted">Control visibility of bib/item records: restrict to a single workgroup, restrict to a single location, or fully suppress from all staff and patrons.</p>

      <div className="panel">
        <h3>Apply Suppression</h3>
        <Feedback type={msg?.type} message={msg?.text} />
        <form onSubmit={submit} className="grid-2">
          <div>
            <label>Record type</label>
            <select value={form.record_type} onChange={(e) => setForm({ ...form, record_type: e.target.value, record_id: '' })}>
              <option value="BIB">Bibliographic record</option>
              <option value="ITEM">Item</option>
            </select>
          </div>
          <div>
            <label>Record</label>
            <select value={form.record_id} onChange={(e) => setForm({ ...form, record_id: e.target.value })} required>
              <option value="">Select...</option>
              {recordOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label>Scope</label>
            <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
              <option value="WORKGROUP">Workgroup-only</option>
              <option value="LOCATION">Specific location</option>
              <option value="ALL">All staff &amp; patrons (fully suppressed)</option>
            </select>
          </div>
          {form.scope === 'WORKGROUP' && (
            <div>
              <label>Workgroup</label>
              <input value={form.workgroup} onChange={(e) => setForm({ ...form, workgroup: e.target.value })} required />
            </div>
          )}
          {form.scope === 'LOCATION' && (
            <div>
              <label>Location</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
            </div>
          )}
          <div>
            <label>Reason</label>
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div><button className="btn" type="submit">Apply suppression</button></div>
        </form>
      </div>

      <div className="panel">
        <h3>Visibility Checker</h3>
        <p className="muted">Simulate how a given viewer (staff or patron, at a workgroup/location) would see a record.</p>
        <form onSubmit={runCheck} className="grid-2">
          <div>
            <label>Record type</label>
            <select value={checkForm.record_type} onChange={(e) => setCheckForm({ ...checkForm, record_type: e.target.value, record_id: '' })}>
              <option value="BIB">Bibliographic record</option>
              <option value="ITEM">Item</option>
            </select>
          </div>
          <div>
            <label>Record</label>
            <select value={checkForm.record_id} onChange={(e) => setCheckForm({ ...checkForm, record_id: e.target.value })} required>
              <option value="">Select...</option>
              {checkRecordOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label><input type="checkbox" checked={checkForm.viewer_is_staff} onChange={(e) => setCheckForm({ ...checkForm, viewer_is_staff: e.target.checked })} /> Viewer is staff (unchecked = patron/OPAC)</label>
          </div>
          <div>
            <label>Viewer workgroup</label>
            <input value={checkForm.viewer_workgroup} onChange={(e) => setCheckForm({ ...checkForm, viewer_workgroup: e.target.value })} />
          </div>
          <div>
            <label>Viewer location</label>
            <input value={checkForm.viewer_location} onChange={(e) => setCheckForm({ ...checkForm, viewer_location: e.target.value })} />
          </div>
          <div><button className="btn" type="submit">Check visibility</button></div>
        </form>
        {checkResult && (
          <Feedback type={checkResult.isError ? 'error' : checkResult.visible ? 'success' : 'warn'} message={`${checkResult.visible ? 'VISIBLE' : 'HIDDEN'} — ${checkResult.reason}`} />
        )}
      </div>

      <div className="panel">
        <h3>Active Suppression Rules</h3>
        {rules.length === 0 && <p className="muted">No records are currently suppressed.</p>}
        <table>
          <thead><tr><th>Record</th><th>Type</th><th>Scope</th><th>Detail</th><th>Reason</th><th></th></tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.record_title || `#${r.record_id}`}</td>
                <td>{r.record_type}</td>
                <td><span className="badge warn">{r.scope}</span></td>
                <td>{r.scope === 'WORKGROUP' ? r.workgroup : r.scope === 'LOCATION' ? r.location : '—'}</td>
                <td>{r.reason || <span className="muted">—</span>}</td>
                <td><button className="btn btn-sm secondary" onClick={() => remove(r.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
