/* ============================================================
   ZENMARKET — Admin API Router  (Vercel Serverless Function)
   ============================================================
   Vercel's Hobby plan caps a deployment at 12 Serverless
   Functions. This project previously shipped one physical
   function per admin endpoint (10 files), which pushed the
   total function count over the limit and failed the build:

     "No more than 12 Serverless Functions can be added to a
      Deployment on the Hobby plan."

   This single catch-all function now serves every /api/admin/*
   route by dispatching on the first path segment. The actual
   route logic is unchanged — each handler was simply renamed
   with a leading underscore (e.g. auth.js -> _route-auth.js)
   so Vercel no longer treats it as its own function, and is
   required here instead. Public URLs are identical to before:

     /api/admin/auth              -> _route-auth.js
     /api/admin/config            -> _route-config.js
     /api/admin/contact-messages  -> _route-contact-messages.js
     /api/admin/db-status         -> _route-db-status.js
     /api/admin/newsletter        -> _route-newsletter.js
     /api/admin/orders            -> _route-orders.js
     /api/admin/products          -> _route-products.js
     /api/admin/reviews           -> _route-reviews.js
     /api/admin/upload            -> _route-upload.js
     /api/admin/users             -> _route-users.js

   bodyParser is disabled for the whole router (needed by
   upload.js for large base64 payloads); every route already
   parses its own raw body via a local readJson() helper, so
   this is safe for all of them.
   ============================================================ */

const routes = {
  'auth':              () => require('./_route-auth'),
  'config':            () => require('./_route-config'),
  'contact-messages':  () => require('./_route-contact-messages'),
  'db-status':         () => require('./_route-db-status'),
  'newsletter':        () => require('./_route-newsletter'),
  'orders':            () => require('./_route-orders'),
  'products':          () => require('./_route-products'),
  'reviews':           () => require('./_route-reviews'),
  'upload':            () => require('./_route-upload'),
  'users':             () => require('./_route-users'),
};

module.exports = async function handler(req, res) {
  // req.query.action is normally an array (e.g. ['users']) supplied by
  // Vercel's [...action] catch-all matching. Some edge/proxy configs can
  // deliver it as a single string, a "users/" value with a trailing
  // slash, or drop it from req.query entirely — normalise defensively,
  // and fall back to parsing req.url directly, so a stray slash, casing
  // difference, or missing query param never falls through to a false 404.
  const raw = req.query.action;
  let segments = Array.isArray(raw) ? raw : (raw ? [raw] : []);

  if (!segments.length && req.url) {
    const pathname = req.url.split('?')[0];
    const afterAdmin = pathname.replace(/^\/?api\/admin\/?/i, '');
    segments = afterAdmin.split('/').filter(Boolean);
  }

  const route = String(segments[0] || '').trim().toLowerCase().replace(/\/+$/, '');

  const loader = routes[route];
  if (!loader) {
    console.warn(`[admin router] No route for "${route}" (raw action: ${JSON.stringify(raw)}). Known routes: ${Object.keys(routes).join(', ')}`);
    return res.status(404).json({ error: 'Not found' });
  }

  let mod;
  try {
    mod = loader();
  } catch (err) {
    console.error(`[admin router] Failed to load route "${route}":`, err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }

  const fn = typeof mod === 'function' ? mod : mod.default;
  return fn(req, res);
};

// MUST be set on module.exports (not on the inner handler) so Vercel
// picks it up for this file. Keeps large uploads working the same
// way api/admin/upload.js's own config used to.
module.exports.config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};