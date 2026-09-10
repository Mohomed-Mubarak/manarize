const fs   = require('fs');
const path = require('path');

// ── 1. Load .env (or process.env on Vercel) ────────────────────────
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  fs.readFileSync(filePath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq < 0) return;
    const key = trimmed.slice(0, eq).trim();
    let val   = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  });
}

const envFile = path.join(__dirname, '.env');

if (fs.existsSync(envFile)) {
  console.log('[build] 📄  Loading .env');
  loadEnvFile(envFile);
} else {
  console.log('[build] ℹ   No .env found — using process.env (Vercel)');
}

// ── 2. Read vars ────────────────────────────────────────────────────
function get(key, fallback = '') {
  const val = process.env[key];
  return val && val.trim() ? val.trim() : fallback;
}

// ── 3. Validate required production vars ────────────────────────────
const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missing  = required.filter(k => !get(k));
if (missing.length > 0) {
  console.error(`[build] ERROR: missing required vars: ${missing.join(', ')}`);
  console.error('[build] HINT: Fill in .env from .env.example with your Supabase credentials');
  process.exit(1);
}

const _sbUrl = get('SUPABASE_URL', '');
const _sbKey = get('SUPABASE_ANON_KEY', '');
const _supabaseConfigured = Boolean(
  _sbUrl && !_sbUrl.includes('YOUR_PROJECT') &&
  _sbKey && !_sbKey.includes('YOUR_') && _sbKey.length > 20
);
if (!_supabaseConfigured) {
  console.error('[build] ERROR: SUPABASE_URL / SUPABASE_ANON_KEY still look like placeholders.');
  console.error('[build] HINT: Fill in .env from .env.example with your real Supabase credentials');
  process.exit(1);
}

// Warn about server-only vars
['SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_API_TOKEN', 'PAYHERE_MERCHANT_SECRET', 'SITE_URL']
  .forEach(k => { if (!get(k)) console.warn(`[build] WARNING: ${k} is not set — needed by serverless API routes`); });

// ── Detect placeholder values that will break payments, email, login ──
const PLACEHOLDER_PATTERNS = [/^YOUR_/i, /yourdomain\.com$/i];
const PLACEHOLDER_VARS = [
  'PAYHERE_MERCHANT_ID',
  'PAYHERE_MERCHANT_SECRET',
  'EMAILJS_PUBLIC_KEY',
  'EMAILJS_SERVICE_ID',
  'EMAILJS_TEMPLATE_ID',
  'EMAILJS_ADMIN_EMAIL',
  'SITE_URL',
];
const unfilled = PLACEHOLDER_VARS.filter(k => {
  const v = get(k);
  return v && PLACEHOLDER_PATTERNS.some(re => re.test(v));
});
if (unfilled.length > 0) {
  console.log('[build] ───────────────────────────────────────────────────────────');
  console.log('[build] NOTE: optional integrations not yet configured:');
  unfilled.forEach(k => console.log(`[build]   ${k}=${get(k)}`));
  console.log('[build]');
  console.log('[build] Site builds and runs fine without these. They only gate:');
  if (unfilled.some(k => k.startsWith('PAYHERE')))    console.log('[build]   💳  Real PayHere payments (checkout runs in simulated mode until set)');
  if (unfilled.some(k => k.startsWith('EMAILJS')))    console.log('[build]   📧  Contact-form email delivery (messages still save to the admin panel)');
  if (unfilled.some(k => k === 'SITE_URL'))           console.log('[build]   🔐  Cross-origin API/webhook calls (same-origin site usage is unaffected)');
  console.log('[build]');
  console.log('[build] Add real values in Vercel Environment Variables when ready.');
  console.log('[build] ───────────────────────────────────────────────────────────');
  // Informational only — never blocks build or deploy.
}

// ── 4. PUBLIC vars only — never put secrets in browser bundle ─────
//   NEVER add SUPABASE_SERVICE_ROLE_KEY, ADMIN_API_TOKEN, PAYHERE_MERCHANT_SECRET here.
const env = {
  SUPABASE_URL:        get('SUPABASE_URL',        ''),
  SUPABASE_ANON_KEY:   get('SUPABASE_ANON_KEY',   ''),
  PAYHERE_MERCHANT_ID: get('PAYHERE_MERCHANT_ID',  'YOUR_MERCHANT_ID'),
  PAYHERE_SANDBOX:     get('PAYHERE_SANDBOX',      'true') !== 'false',
  WA_PHONE:            get('WA_PHONE',             ''),
  WA_PHONE_2:          get('WA_PHONE_2',           ''),
  POSTHOG_KEY:         get('POSTHOG_KEY',          ''),
  POSTHOG_HOST:        get('POSTHOG_HOST',         'https://app.posthog.com'),
  EMAILJS_PUBLIC_KEY:  get('EMAILJS_PUBLIC_KEY',   ''),
  EMAILJS_SERVICE_ID:  get('EMAILJS_SERVICE_ID',   ''),
  EMAILJS_TEMPLATE_ID: get('EMAILJS_TEMPLATE_ID',  ''),
  EMAILJS_ADMIN_EMAIL:  get('EMAILJS_ADMIN_EMAIL',  'admin@manarize.lk'),
  // hCaptcha — site key is PUBLIC (safe in browser bundle)
  // Secret key lives only in Vercel env vars (server-side /api routes)
  HCAPTCHA_SITE_KEY:   get('HCAPTCHA_SITE_KEY',   '10000000-ffff-ffff-ffff-000000000001'),
  // SECURITY: ADMIN_API_TOKEN is intentionally excluded from this public bundle.
  // Admin API calls must authenticate via Supabase session JWT with role='admin'.
  // See api/admin/* handlers: they verify req.headers['x-supabase-jwt'] server-side.
};

function jsStr(v) {
  return String(v)
    .replace(/\\/g, '\\\\')
    .replace(/`/g,  '\\`')
    .replace(/\$/g, '\\$');
}

// ── 5. Write js/env.js ────────────────────────────────────────────
const out = `// AUTO-GENERATED by build.js — do not edit manually.
// Source: ${fs.existsSync(envFile) ? '.env' : 'process.env (Vercel)'}
// Generated: ${new Date().toISOString()}
//
// ⚠  This file is GITIGNORED — do not commit it.
//    Production secrets come from .env (gitignored) or Vercel env vars.
//
// ⚠  SECURITY: Only PUBLIC variables are written here.
//    SERVER-ONLY vars (service role key, admin token, merchant secret)
//    are accessed exclusively by Vercel Serverless Functions via process.env.

export const ENV = Object.freeze({
  SUPABASE_URL:        \`${jsStr(env.SUPABASE_URL)}\`,
  SUPABASE_ANON_KEY:   \`${jsStr(env.SUPABASE_ANON_KEY)}\`,
  PAYHERE_MERCHANT_ID: \`${jsStr(env.PAYHERE_MERCHANT_ID)}\`,
  PAYHERE_SANDBOX:     ${env.PAYHERE_SANDBOX},
  WA_PHONE:            \`${jsStr(env.WA_PHONE)}\`,
  WA_PHONE_2:          \`${jsStr(env.WA_PHONE_2)}\`,
  POSTHOG_KEY:         \`${jsStr(env.POSTHOG_KEY)}\`,
  POSTHOG_HOST:        \`${jsStr(env.POSTHOG_HOST)}\`,
  EMAILJS_PUBLIC_KEY:  \`${jsStr(env.EMAILJS_PUBLIC_KEY)}\`,
  EMAILJS_SERVICE_ID:  \`${jsStr(env.EMAILJS_SERVICE_ID)}\`,
  EMAILJS_TEMPLATE_ID: \`${jsStr(env.EMAILJS_TEMPLATE_ID)}\`,
  EMAILJS_ADMIN_EMAIL: \`${jsStr(env.EMAILJS_ADMIN_EMAIL)}\`,
  HCAPTCHA_SITE_KEY:   \`${jsStr(env.HCAPTCHA_SITE_KEY)}\`,
  // ADMIN_API_TOKEN intentionally omitted — server-only secret, never in browser bundle.
});
`;

const outPath = path.join(__dirname, 'js', 'env.js');
fs.writeFileSync(outPath, out, 'utf8');
console.log('[build] ✓ js/env.js written');
console.log('[build] ⚠  js/env.js is gitignored — do not commit it');

// ── 6. Performance build: JS minification + HTML processing ──────
// Minifies all client JS → dist/js/, processes HTML for perf.
(async () => {
  try {
    const runPerfBuild = require('./perf-build.js');
    await runPerfBuild();
  } catch (e) {
    console.warn('[build] ⚠  perf-build error:', e.message);
  }
})();

console.log('[build] ✓ Production build ready. Deploy to Vercel or run: npx serve .');