const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Missing bearer token.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.staff = payload; // { id, username, privileges, workgroup, location }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token. Please log in again.' });
  }
}

// Factory: requirePrivilege('deleteRecords') -> middleware that 403s if the
// logged-in staff member's privilege set doesn't grant it.
function requirePrivilege(privilegeKey) {
  return (req, res, next) => {
    if (!req.staff) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const privileges = req.staff.privileges || {};
    if (!privileges[privilegeKey]) {
      return res.status(403).json({
        error: `Access denied: your account lacks the "${privilegeKey}" privilege required for this action.`,
      });
    }
    next();
  };
}

module.exports = { requireAuth, requirePrivilege, JWT_SECRET };
