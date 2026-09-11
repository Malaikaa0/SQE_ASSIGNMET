// Req 5615 (Real-time processing): every response is explicitly marked
// non-cacheable so browsers/proxies never serve stale data and each fetch
// hits PostgreSQL live.
function noCache(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
}

module.exports = noCache;
