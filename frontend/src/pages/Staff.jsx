import { useEffect, useState } from 'react';
import { api } from '../api';
import Feedback from '../components/Feedback.jsx';

const PRIVILEGE_KEYS = [
  'manageStaff', 'manageLoanRules', 'manageRequestingRules', 'deleteRecords',
  'manageSuppression', 'manageLocks', 'viewMonitoring', 'manageMonitoring', 'overrideHolds',
];

const emptyForm = {
  username: '', password: '', full_name: '', email: '', workgroup: 'DEFAULT', location: 'MAIN',
  role_template_id: '', privilege_overrides: {},
};

export default function Staff() {
  const [staffList, setStaffList] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState(null);

  async function loadAll() {
    const [s, t] = await Promise.all([api('/staff'), api('/staff/role-templates')]);
    setStaffList(s); setTemplates(t);
  }
  useEffect(() => { loadAll(); }, []);

  function applyTemplate(id) {
    setForm((f) => {
      const tmpl = templates.find((t) => String(t.id) === String(id));
      return { ...f, role_template_id: id, privilege_overrides: tmpl ? { ...tmpl.default_privileges } : {} };
    });
  }

  function togglePrivilege(key) {
    setForm((f) => ({ ...f, privilege_overrides: { ...f.privilege_overrides, [key]: !f.privilege_overrides[key] } }));
  }

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/staff', { method: 'POST', body: { ...form, role_template_id: form.role_template_id ? Number(form.role_template_id) : null } });
      setMsg({ type: 'success', text: `Staff account "${form.username}" created with role "${templates.find(t => String(t.id) === String(form.role_template_id))?.name || 'custom'}".` });
      setForm(emptyForm);
      loadAll();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  async function toggleActive(s) {
    setMsg(null);
    try {
      await api(`/staff/${s.id}`, { method: 'PUT', body: { active: !s.active } });
      setMsg({ type: 'success', text: `${s.username} is now ${!s.active ? 'active' : 'inactive'}.` });
      loadAll();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function resetPassword(s) {
    const pw = window.prompt(`New password for ${s.username} (min 8 characters):`);
    if (!pw) return;
    setMsg(null);
    try {
      await api(`/staff/${s.id}/reset-password`, { method: 'POST', body: { new_password: pw } });
      setMsg({ type: 'success', text: `Password reset for ${s.username}.` });
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  return (
    <div>
      <h2>Staff Account Setup <span className="req-tag">SRS Req 2420</span></h2>
      <p className="muted">Create staff accounts from role templates with granular, per-account privilege overrides. Passwords are bcrypt-hashed (Req 6510).</p>

      <div className="panel">
        <h3>Create Staff Account</h3>
        <Feedback type={msg?.type} message={msg?.text} />
        <form onSubmit={submit}>
          <div className="grid-2">
            <div>
              <label>Username</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div>
              <label>Password (min 8 chars)</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div>
              <label>Full name</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label>Workgroup</label>
              <input value={form.workgroup} onChange={(e) => setForm({ ...form, workgroup: e.target.value })} />
            </div>
            <div>
              <label>Location</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label>Role template</label>
              <select value={form.role_template_id} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Custom (no template)</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <label>Granular privileges (auto-filled from template, override as needed)</label>
          <div className="privs">
            {PRIVILEGE_KEYS.map((k) => (
              <label key={k}>
                <input type="checkbox" checked={!!form.privilege_overrides[k]} onChange={() => togglePrivilege(k)} />
                {k}
              </label>
            ))}
          </div>

          <button className="btn" type="submit">Create staff account</button>
        </form>
      </div>

      <div className="panel">
        <h3>Existing Staff Accounts</h3>
        <table>
          <thead><tr><th>Username</th><th>Full name</th><th>Role</th><th>Workgroup/Location</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {staffList.map((s) => (
              <tr key={s.id}>
                <td>{s.username}</td>
                <td>{s.full_name}</td>
                <td>{s.role_template_name || 'Custom'}</td>
                <td>{s.workgroup} / {s.location}</td>
                <td><span className={`badge ${s.active ? 'ok' : 'bad'}`}>{s.active ? 'Active' : 'Inactive'}</span></td>
                <td className="row-actions">
                  <button className="btn btn-sm secondary" onClick={() => resetPassword(s)}>Reset password</button>
                  <button className={`btn btn-sm ${s.active ? 'danger' : 'secondary'}`} onClick={() => toggleActive(s)}>{s.active ? 'Deactivate' : 'Activate'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Role Templates</h3>
        <table>
          <thead><tr><th>Name</th><th>Description</th><th>Default Privileges</th></tr></thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.description}</td>
                <td className="muted">{Object.entries(t.default_privileges).filter(([, v]) => v).map(([k]) => k).join(', ') || 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
