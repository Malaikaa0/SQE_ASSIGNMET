import { Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import { getStaff } from './api';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LoanRules from './pages/LoanRules.jsx';
import RequestingRules from './pages/RequestingRules.jsx';
import Records from './pages/Records.jsx';
import Suppression from './pages/Suppression.jsx';
import Locks from './pages/Locks.jsx';
import Monitoring from './pages/Monitoring.jsx';
import Staff from './pages/Staff.jsx';

function Protected({ children }) {
  const staff = getStaff();
  if (!staff) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <Nav />
      <div className="main">{children}</div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/loan-rules" element={<Protected><LoanRules /></Protected>} />
      <Route path="/requesting-rules" element={<Protected><RequestingRules /></Protected>} />
      <Route path="/records" element={<Protected><Records /></Protected>} />
      <Route path="/suppression" element={<Protected><Suppression /></Protected>} />
      <Route path="/locks" element={<Protected><Locks /></Protected>} />
      <Route path="/monitoring" element={<Protected><Monitoring /></Protected>} />
      <Route path="/staff" element={<Protected><Staff /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
