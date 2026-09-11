// Thin fetch wrapper. Req 5615 (real-time): cache: 'no-store' on every
// request so the browser never serves a stale response; every call hits
// the API fresh. Req 6510/6511: talks to the backend exclusively over
// HTTPS (see API_BASE) and attaches the bearer session token.
export const API_BASE = import.meta.env.VITE_API_BASE || 'https://localhost:8443/api';

function getToken() {
  return localStorage.getItem('las_token');
}

export function setSession(token, staff) {
  localStorage.setItem('las_token', token);
  localStorage.setItem('las_staff', JSON.stringify(staff));
}

export function clearSession() {
  localStorage.removeItem('las_token');
  localStorage.removeItem('las_staff');
}

export function getStaff() {
  const raw = localStorage.getItem('las_staff');
  return raw ? JSON.parse(raw) : null;
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch (err) {
    throw new Error(
      `Cannot reach the API server at ${API_BASE}. Is the backend running? ` +
      `If this is the first request, your browser may be blocking the self-signed HTTPS certificate — ` +
      `open ${API_BASE.replace('/api', '')} directly in a new tab and accept the security warning, then retry.`
    );
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed with status ${res.status}.`;
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}
