import { NavLink, useNavigate } from 'react-router-dom';
import { clearSession, getStaff } from '../api';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/loan-rules', label: 'Loan Rules (5057)' },
  { to: '/requesting-rules', label: 'Requesting Rules (5190)' },
  { to: '/records', label: 'Records & Deletion (2445)' },
  { to: '/suppression', label: 'Suppression Rules (5278)' },
  { to: '/locks', label: 'Record Locks (6513/7302)' },
  { to: '/monitoring', label: 'Monitoring & Alerts (6501)' },
  { to: '/staff', label: 'Staff Accounts (2420)' },
];

export default function Nav() {
  const navigate = useNavigate();
  const staff = getStaff();

  function logout() {
    clearSession();
    navigate('/login');
  }

  return (
    <div className="sidebar">
      <h1>Library Admin System</h1>
      <nav>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      {staff && (
        <div className="staff-info">
          Logged in as <strong>{staff.fullName}</strong>
          <br />
          {staff.roleTemplate || 'No role'} · {staff.workgroup} / {staff.location}
        </div>
      )}
      <button className="logout-btn" onClick={logout}>Log out</button>
    </div>
  );
}
