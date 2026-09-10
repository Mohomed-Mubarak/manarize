/* ============================================================
   ZENMARKET — STORE ADAPTER  (v30 — Production, Supabase-only)
   ============================================================
   Unified data access layer over js/supabase-store.js
   (PostgreSQL via Supabase).

   USAGE:
     import { getProducts, saveOrder } from './store-adapter.js';
   ============================================================ */

let _store = null;

async function getStore() {
  if (_store) return _store;
  _store = await import('./supabase-store.js');
  return _store;
}

function wrap(fn) {
  return async (...args) => {
    const store = await getStore();
    const result = store[fn]?.(...args);
    return result instanceof Promise ? await result : result;
  };
}

// ── Products ──────────────────────────────────────────────────────

export const getProducts      = wrap('getProducts');
export const getProduct       = wrap('getProduct');
export const searchProducts   = wrap('searchProducts');
export const decrementStock   = wrap('decrementStock');

// Admin mutations — save/delete persist to Supabase in production,
// localStorage in demo mode.
export const saveProduct   = wrap('saveProduct');
export const deleteProduct = wrap('deleteProduct');

// Pure utility helpers — same implementation in both backends.
export async function generateProductId() {
  const store = await getStore();
  return store.generateProductId();
}
export async function generateSlug(name) {
  const store = await getStore();
  return store.generateSlug(name);
}

// ── Orders ────────────────────────────────────────────────────────

export const saveOrder    = wrap('saveOrder');
export const getMyOrders  = wrap('getMyOrders');
export const getOrder     = wrap('getOrder');

// ── Categories ────────────────────────────────────────────────────

export const getCategories  = wrap('getCategories');
export const saveCategories = wrap('saveCategories');

// ── Coupons ───────────────────────────────────────────────────────

export const getCoupon             = wrap('getCoupon');
export const incrementCouponUsage  = wrap('incrementCouponUsage');

// ── Shipping ──────────────────────────────────────────────────────

export const getShippingZones = wrap('getShippingZones');

// ── Reviews ───────────────────────────────────────────────────────

export const getProductReviews = wrap('getProductReviews');
export const submitReview      = wrap('submitReview');

// ── Profile ───────────────────────────────────────────────────────

export const getProfile    = wrap('getProfile');
export const updateProfile = wrap('updateProfile');

// ── Contact ───────────────────────────────────────────────────────

export const saveContactMessage = wrap('saveContactMessage');

// ── Orders (admin full CRUD) ──────────────────────────────────────

export const getOrders    = wrap('getOrders');
export const saveOneOrder = wrap('saveOneOrder');
export const updateOrder  = wrap('updateOrder');
export const deleteOrder  = wrap('deleteOrder');
export const deleteOrders = wrap('deleteOrders');

// ── Coupons (admin full CRUD) ─────────────────────────────────────

export const getCoupons  = wrap('getCoupons');
export const saveCoupons = wrap('saveCoupons');
export const insertCoupon = wrap('insertCoupon');
export const deleteCoupon = wrap('deleteCoupon');
export const toggleCoupon = wrap('toggleCoupon');

// ── Shipping zones (admin save) ───────────────────────────────────

export const saveShippingZones = wrap('saveShippingZones');

// ── Users (admin) ─────────────────────────────────────────────────

export const getUsers  = wrap('getUsers');
export const saveUsers = wrap('saveUsers');

// ── Blog posts ────────────────────────────────────────────────────

export const getBlogPosts   = wrap('getBlogPosts');
export const getBlogPost    = wrap('getBlogPost');
export const saveBlogPost   = wrap('saveBlogPost');
export const savePosts      = wrap('savePosts');
export const getPosts       = wrap('getPosts');
export const deleteBlogPost = wrap('deleteBlogPost');

// ── Notifications ─────────────────────────────────────────────────

export const getNotifications         = wrap('getNotifications');
export const addNotification          = wrap('addNotification');
export const markNotificationRead     = wrap('markNotificationRead');
export const markAllNotificationsRead = wrap('markAllNotificationsRead');

// ── Site settings ─────────────────────────────────────────────────

export const getSiteSettings  = wrap('getSiteSettings');
export const saveSiteSettings = wrap('saveSiteSettings');

// ── Reviews (extended admin + user) ───────────────────────────

export const getProductReviewsAdmin  = wrap('getProductReviewsAdmin');
export const getAllReviewsFlat        = wrap('getAllReviewsFlat');
export const getUserReview            = wrap('getUserReview');
export const getUserReviews           = wrap('getUserReviews');
export const editReview               = wrap('editReview');
export const approveReview            = wrap('approveReview');
export const rejectReview             = wrap('rejectReview');
export const submitReviewV2           = wrap('submitReviewV2');

// ── Addresses ─────────────────────────────────────────────────

export const getAddressesSupabase  = wrap('getAddresses');
export const saveAddressesSupabase = wrap('saveAddresses');

// ── Newsletter ─────────────────────────────────────────────────

export const saveNewsletterSubscriber   = wrap('saveNewsletterSubscriber');
export const getNewsletterSubscribers   = wrap('getNewsletterSubscribers');
export const deleteNewsletterSubscriber = wrap('deleteNewsletterSubscriber');

// ── Contact Messages (full CRUD) ───────────────────────────────

export const getContactMessages      = wrap('getContactMessages');
export const markContactMessageRead  = wrap('markContactMessageRead');
export const deleteContactMessage    = wrap('deleteContactMessage');

// ── Shipping helpers ─────────────────────────────────────────
// Zones come from Supabase via getShippingZones(); adminDefaultRate
// is the site-wide fallback rate configured in admin settings.
export async function getShippingRate(district) {
  // Read admin-configured default rate (site_settings.shipRate)
  let adminDefaultRate = 350;
  try {
    const { getSiteSettings } = await import('./supabase-store.js');
    const raw = await getSiteSettings().catch(() => null) || {};
    const flatRate = raw.shipRate;
    const rateVal = (flatRate && typeof flatRate === 'object' && 'v' in flatRate) ? flatRate.v : flatRate;
    if (rateVal) adminDefaultRate = Number(rateVal) || 350;
  } catch {
    try {
      const ls = JSON.parse(localStorage.getItem('zm_site_settings') || '{}');
      if (ls.shipRate) adminDefaultRate = Number(ls.shipRate) || 350;
    } catch {}
  }
  try {
    const zones = await (await getStore()).getShippingZones?.() || [];
    if (Array.isArray(zones) && zones.length) {
      const z = zones.find(z => (z.provinces || z.districts || []).includes(district));
      if (z) return z.rate ?? z.shippingRate ?? adminDefaultRate;
    }
  } catch {}
  return adminDefaultRate;
}

export async function getDeliveryDays(district) {
  try {
    const zones = await (await getStore()).getShippingZones?.() || [];
    if (Array.isArray(zones) && zones.length) {
      const z = zones.find(z => (z.provinces || z.districts || []).includes(district));
      if (z) return `${z.min_days||z.minDays||2}–${z.max_days||z.maxDays||4} Business Days`;
    }
  } catch {}
  const colombo = ['Colombo','Gampaha','Kalutara'];
  return colombo.includes(district) ? '1–2 Business Days' : '2–4 Business Days';
}
