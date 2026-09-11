import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setSession, API_BASE } from '../api';
import Feedback from '../components/Feedback.jsx';

export default function Login() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: { username, password }, auth: false });
      setSession(data.token, data.staff);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Library Administration System</h1>
        <div className="sub">System Administration Module — sign in</div>

        <Feedback type="error" message={error} />

        <label>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />

        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <button className="btn" type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <div className="hint">
          Seed accounts: <code>admin / Admin123!</code> (full access), <code>circsuper / Circ123!</code>,{' '}
          <code>cataloger / Cat123!</code>.
          <br />
          API: {API_BASE}. If login fails to connect, open that URL directly once and accept the
          self-signed certificate warning (local HTTPS dev cert).
        </div>
      </form>
    </div>
  );
}
