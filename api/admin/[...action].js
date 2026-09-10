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
  const raw = req.query.action;
  const segments = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const route = segments[0];

  const loader = routes[route];
  if (!loader) {
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
