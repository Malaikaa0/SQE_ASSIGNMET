import { useEffect, useState } from 'react';
import { api } from '../api';
import Feedback from '../components/Feedback.jsx';

export default function Records() {
  const [patrons, setPatrons] = useState([]);
  const [bibs, setBibs] = useState([]);
  const [items, setItems] = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [holds, setHolds] = useState([]);
  const [msg, setMsg] = useState(null);

  const [newPatron, setNewPatron] = useState({ name: '', patron_type: 'ADULT', account_balance: 0 });
  const [newBib, setNewBib] = useState({ title: '', author: '', location: 'MAIN' });
  const [newItem, setNewItem] = useState({ barcode: '', bib_id: '', item_type: 'BOOK', status: 'AVAILABLE', location: 'MAIN' });

  async function loadAll() {
    const [p, b, i, c, h] = await Promise.all([
      api('/records/patrons'), api('/records/bib-records'), api('/records/items'),
      api('/records/checkouts'), api('/records/holds'),
    ]);
    setPatrons(p); setBibs(b); setItems(i); setCheckouts(c); setHolds(h);
  }
  useEffect(() => { loadAll(); }, []);

  async function addPatron(e) {
    e.preventDefault(); setMsg(null);
    try {
      await api('/records/patrons', { method: 'POST', body: newPatron });
      setMsg({ type: 'success', text: `Patron "${newPatron.name}" created.` });
      setNewPatron({ name: '', patron_type: 'ADULT', account_balance: 0 });
      loadAll();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function addBib(e) {
    e.preventDefault(); setMsg(null);
    try {
      await api('/records/bib-records', { method: 'POST', body: newBib });
      setMsg({ type: 'success', text: `Bibliographic record "${newBib.title}" created.` });
      setNewBib({ title: '', author: '', location: 'MAIN' });
      loadAll();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function addItem(e) {
    e.preventDefault(); setMsg(null);
    try {
      await api('/records/items', { method: 'POST', body: { ...newItem, bib_id: Number(newItem.bib_id) } });
      setMsg({ type: 'success', text: `Item "${newItem.barcode}" created.` });
      setNewItem({ barcode: '', bib_id: '', item_type: 'BOOK', status: 'AVAILABLE', location: 'MAIN' });
      loadAll();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function deleteBib(b) {
    setMsg(null);
    try {
      await api(`/records/bib-records/${b.id}`, { method: 'DELETE' });
      setMsg({ type: 'success', text: `Bibliographic record "${b.title}" deleted.` });
      loadAll();
    } catch (err) {
      setMsg({ type: 'error', text: `BLOCKED (Req 2445): ${err.message}` });
    }
  }

  async function deleteItem(i) {
    setMsg(null);
    try {
      await api(`/records/items/${i.id}`, { method: 'DELETE' });
      setMsg({ type: 'success', text: `Item "${i.barcode}" deleted.` });
      loadAll();
    } catch (err) {
      setMsg({ type: 'error', text: `BLOCKED (Req 2445): ${err.message}` });
    }
  }

  async function returnCheckout(c) {
    setMsg(null);
    try {
      await api(`/records/checkouts/${c.id}/return`, { method: 'POST' });
      setMsg({ type: 'success', text: `Item ${c.barcode} checked in.` });
      loadAll();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function cancelHold(h) {
    setMsg(null);
    try {
      await api(`/records/holds/${h.id}/cancel`, { method: 'POST' });
      setMsg({ type: 'success', text: `Hold on "${h.bib_title}" cancelled.` });
      loadAll();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  return (
    <div>
      <h2>Records &amp; Deletion Restrictions <span className="req-tag">SRS Req 2445</span></h2>
      <p className="muted">Deleting an item that is checked out, or a bib record with active holds, is blocked with a clear error. Check an item in / cancel a hold first, then delete succeeds.</p>
      <Feedback type={msg?.type} message={msg?.text} />

      <div className="grid-2">
        <div className="panel">
          <h3>Add Patron</h3>
          <form onSubmit={addPatron}>
            <label>Name</label>
            <input value={newPatron.name} onChange={(e) => setNewPatron({ ...newPatron, name: e.target.value })} required />
            <label>Patron type</label>
            <select value={newPatron.patron_type} onChange={(e) => setNewPatron({ ...newPatron, patron_type: e.target.value })}>
              <option>ADULT</option><option>JUVENILE</option><option>STUDENT</option><option>STAFF</option>
            </select>
            <label>Account balance ($)</label>
            <input type="number" step="0.01" value={newPatron.account_balance} onChange={(e) => setNewPatron({ ...newPatron, account_balance: Number(e.target.value) })} />
            <button className="btn" type="submit">Add patron</button>
          </form>
        </div>

        <div className="panel">
          <h3>Add Bibliographic Record</h3>
          <form onSubmit={addBib}>
            <label>Title</label>
            <input value={newBib.title} onChange={(e) => setNewBib({ ...newBib, title: e.target.value })} required />
            <label>Author</label>
            <input value={newBib.author} onChange={(e) => setNewBib({ ...newBib, author: e.target.value })} />
            <label>Location</label>
            <input value={newBib.location} onChange={(e) => setNewBib({ ...newBib, location: e.target.value })} />
            <button className="btn" type="submit">Add bib record</button>
          </form>
        </div>
      </div>

      <div className="panel">
        <h3>Add Item</h3>
        <form onSubmit={addItem} className="grid-2">
          <div>
            <label>Barcode</label>
            <input value={newItem.barcode} onChange={(e) => setNewItem({ ...newItem, barcode: e.target.value })} required />
          </div>
          <div>
            <label>Bib record</label>
            <select value={newItem.bib_id} onChange={(e) => setNewItem({ ...newItem, bib_id: e.target.value })} required>
              <option value="">Select...</option>
              {bibs.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </div>
          <div>
            <label>Item type</label>
            <select value={newItem.item_type} onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value })}>
              <option>BOOK</option><option>DVD</option><option>EQUIPMENT</option><option>REFERENCE</option>
            </select>
          </div>
          <div>
            <label>Status</label>
            <select value={newItem.status} onChange={(e) => setNewItem({ ...newItem, status: e.target.value })}>
              <option>AVAILABLE</option><option>CHECKED_OUT</option><option>LOST</option><option>DAMAGED</option><option>IN_REPAIR</option><option>WITHDRAWN</option>
            </select>
          </div>
          <div><button className="btn" type="submit">Add item</button></div>
        </form>
      </div>

      <div className="panel">
        <h3>Bibliographic Records</h3>
        <table>
          <thead><tr><th>Title</th><th>Author</th><th>Location</th><th>Active Holds</th><th></th></tr></thead>
          <tbody>
            {bibs.map((b) => (
              <tr key={b.id}>
                <td>{b.title}</td><td>{b.author}</td><td>{b.location}</td>
                <td>{b.has_active_holds ? <span className="badge warn">{b.active_hold_count} hold(s)</span> : <span className="badge ok">None</span>}</td>
                <td><button className="btn btn-sm danger" onClick={() => deleteBib(b)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Items</h3>
        <table>
          <thead><tr><th>Barcode</th><th>Title</th><th>Type</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.barcode}</td><td>{i.bib_title}</td><td>{i.item_type}</td>
                <td><span className={`badge ${i.is_checked_out ? 'warn' : i.status === 'AVAILABLE' ? 'ok' : 'neutral'}`}>{i.status}</span></td>
                <td><button className="btn btn-sm danger" onClick={() => deleteItem(i)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>Open Checkouts</h3>
          {checkouts.length === 0 && <p className="muted">None.</p>}
          <table>
            <tbody>
              {checkouts.map((c) => (
                <tr key={c.id}>
                  <td>{c.barcode}</td><td>{c.patron_name}</td>
                  <td>due {new Date(c.due_date).toLocaleDateString()}</td>
                  <td><button className="btn btn-sm secondary" onClick={() => returnCheckout(c)}>Check in</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>Active Holds</h3>
          {holds.filter(h => h.status === 'ACTIVE').length === 0 && <p className="muted">None.</p>}
          <table>
            <tbody>
              {holds.filter(h => h.status === 'ACTIVE').map((h) => (
                <tr key={h.id}>
                  <td>{h.bib_title}</td><td>{h.patron_name}</td>
                  <td><button className="btn btn-sm secondary" onClick={() => cancelHold(h)}>Cancel</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
