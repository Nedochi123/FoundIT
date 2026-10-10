// Vite exposes env vars via import.meta.env.VITE_* — never process.env
// (that's a Create React App convention and silently does nothing here).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

import { geoHeaderValue } from "./geo";

const TOKEN_STORAGE_KEY = "foundit_auth_tokens";
// A cached copy of the last-known user, purely for optimistic startup
// rendering — every network round-trip on this connection costs a fixed
// few hundred ms regardless of app code (Railway's region is far from
// Nile University), so on a returning visit the UI renders instantly
// from this cache instead of showing a blocking "Loading..." screen
// while /api/auth/me confirms the session in the background. It is
// never treated as authoritative — a failed background refresh still
// clears it and logs the user out.
const USER_STORAGE_KEY = "foundit_cached_user";

function getStoredTokens() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredTokens(tokens) {
  try {
    if (tokens) {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Private browsing / storage quota — fail silently, cookie auth
    // still works for same-session use.
  }
}

function clearStoredTokens() {
  setStoredTokens(null);
  setStoredUser(null);
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch {
    // Same private-browsing/quota case as setStoredTokens — the cache
    // is an optimization, not a requirement.
  }
}

// Paths that must never trigger the silent-refresh-and-retry — prevents
// infinite recursion and false "session expired" UX on genuine
// credential errors (a failed login isn't a token expiry).
const NO_REFRESH_RETRY_PATHS = new Set([
  "/api/auth/refresh",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
]);

async function apiRequest(path, options = {}, _isRetry = false) {
  const tokens = getStoredTokens();
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    // where the phone is, sent with anything that changes something (the owner's security log; see lib/geo.js)
    ...(options.method && options.method !== "GET" && geoHeaderValue() ? { "X-Geo": geoHeaderValue() } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  // Keep the localStorage fallback in sync whenever the server sends a
  // fresh token pair, even on a route that isn't strictly an auth route.
  if (data?.accessToken && data?.refreshToken) {
    setStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  }

  if (res.status === 401 && !_isRetry && !NO_REFRESH_RETRY_PATHS.has(path)) {
    const refreshed = await apiRequest(
      "/api/auth/refresh",
      { method: "POST", body: JSON.stringify({ refreshToken: tokens?.refreshToken }) },
      true
    ).catch(() => null);

    if (refreshed) {
      return apiRequest(path, options, true);
    }
    clearStoredTokens();
  }

  if (!res.ok) {
    const error = new Error(data?.error || `Request failed with ${res.status}`);
    error.status = res.status;
    throw error;
  }

  return data;
}

export const api = {
  // Messages to the admin (complaints and problems); the admin answers from the owner page
  getSupportMessages: () => apiRequest("/api/support"),
  getSupportUnread: () => apiRequest("/api/support/unread"),
  sendSupportMessage: (body) => apiRequest("/api/support", { method: "POST", body: JSON.stringify({ body }) }),

  // Security: the app tells the server it was opened (the location goes in the X-Geo header)
  checkin: () => apiRequest("/api/activity/checkin", { method: "POST" }),

  // Auth
  signup: (body) => apiRequest("/api/auth/signup", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () =>
    apiRequest("/api/auth/logout", { method: "POST" }).finally(() => clearStoredTokens()),
  me: () => apiRequest("/api/auth/me"),
  forgotPassword: (email) =>
    apiRequest("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token, password) =>
    apiRequest("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),
  verifyEmail: (token) =>
    apiRequest("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }),
  resendVerification: () => apiRequest("/api/auth/resend-verification", { method: "POST" }),
  changePassword: (currentPassword, newPassword) =>
    apiRequest("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
  deleteAccount: (password) =>
    apiRequest("/api/auth/delete-account", { method: "POST", body: JSON.stringify({ password }) }),
  updateProfile: (body) => apiRequest("/api/users/me", { method: "PATCH", body: JSON.stringify(body) }),

  // Found items
  listFoundItems: (status = "open") => apiRequest(`/api/found-items?status=${status}`),
  createFoundItem: (formData) => apiRequest("/api/found-items", { method: "POST", body: formData }),
  resolveFoundItem: (id) => apiRequest(`/api/found-items/${id}/resolve`, { method: "PATCH" }),

  // Lost items
  listLostItems: (status = "open") => apiRequest(`/api/lost-items?status=${status}`),
  createLostItem: (body) => apiRequest("/api/lost-items", { method: "POST", body: JSON.stringify(body) }),
  resolveLostItem: (id) => apiRequest(`/api/lost-items/${id}/resolve`, { method: "PATCH" }),
  // "Urgently need": a lost post with a compulsory reward; publishing alerts everyone
  listUrgentItems: () => apiRequest("/api/lost-items/urgent"),
  createUrgentItem: (body) => apiRequest("/api/lost-items/urgent", { method: "POST", body: JSON.stringify(body) }),

  // Conversations & messages
  listConversations: () => apiRequest("/api/conversations"),
  openConversation: (foundItemId) =>
    apiRequest("/api/conversations", { method: "POST", body: JSON.stringify({ foundItemId }) }),
  getMessages: (conversationId) => apiRequest(`/api/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, body) =>
    apiRequest(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  confirmReturn: (conversationId, note, rewardAmount, urgentItemId) =>
    apiRequest(`/api/conversations/${conversationId}/confirm-return`, {
      method: "POST",
      body: JSON.stringify({
        note: note || undefined,
        rewardAmount: rewardAmount || undefined,
        urgentItemId: urgentItemId || undefined,
      }),
    }),

  // Voluntary thank-you reward (the owner pays the finder directly; FoundIT never handles the money)
  giveReward: (conversationId, amount) =>
    apiRequest(`/api/conversations/${conversationId}/reward`, { method: "POST", body: JSON.stringify({ amount }) }),
  markRewardSent: (conversationId) =>
    apiRequest(`/api/conversations/${conversationId}/reward/sent`, { method: "POST" }),
  markRewardReceived: (conversationId) =>
    apiRequest(`/api/conversations/${conversationId}/reward/received`, { method: "POST" }),

  // QR "Return me" tags. The finder's calls (public, no sign-in) identify their chat by a secret token
  // sent in the X-Chat-Token header; the owner's calls use the normal sign-in.
  getPublicTag: (code) => apiRequest(`/api/tags/public/${encodeURIComponent(code)}`),
  startTagChat: (code, body) =>
    apiRequest(`/api/tags/public/${encodeURIComponent(code)}/chat`, { method: "POST", body: JSON.stringify(body) }),
  getTagChat: (code, token) =>
    apiRequest(`/api/tags/public/${encodeURIComponent(code)}/chat`, { headers: { "X-Chat-Token": token } }),
  sendTagChatMessage: (code, token, message) =>
    apiRequest(`/api/tags/public/${encodeURIComponent(code)}/chat/messages`, {
      method: "POST",
      headers: { "X-Chat-Token": token },
      body: JSON.stringify({ message }),
    }),
  shareTagChatContact: (code, token, contact) =>
    apiRequest(`/api/tags/public/${encodeURIComponent(code)}/chat/contact`, {
      method: "POST",
      headers: { "X-Chat-Token": token },
      body: JSON.stringify(contact),
    }),
  getMyTags: () => apiRequest("/api/tags"),
  claimTag: (code, label) =>
    apiRequest("/api/tags/claim", { method: "POST", body: JSON.stringify({ code, label: label || undefined }) }),
  updateTag: (id, body) => apiRequest(`/api/tags/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  releaseTag: (id) => apiRequest(`/api/tags/${id}/release`, { method: "POST" }),
  getTagThreads: (id) => apiRequest(`/api/tags/${id}/threads`),
  getTagThread: (id, threadId) => apiRequest(`/api/tags/${id}/threads/${threadId}`),
  sendTagThreadMessage: (id, threadId, message) =>
    apiRequest(`/api/tags/${id}/threads/${threadId}/messages`, { method: "POST", body: JSON.stringify({ message }) }),
  shareTagThreadContact: (id, threadId, contact) =>
    apiRequest(`/api/tags/${id}/threads/${threadId}/contact`, { method: "POST", body: JSON.stringify(contact) }),
  deleteTagThread: (id, threadId) => apiRequest(`/api/tags/${id}/threads/${threadId}`, { method: "DELETE" }),
  adminGenerateTags: (count) =>
    apiRequest("/api/tags/admin/generate", { method: "POST", body: JSON.stringify({ count }) }),
  adminTagSummary: () => apiRequest("/api/tags/admin/summary"),

  // Paid boosts for lost posts (the student pays by bank transfer; the admin approves)
  getBoostPlans: () => apiRequest("/api/boosts/plans"),
  createBoost: (lostItemId, plan) => apiRequest("/api/boosts", { method: "POST", body: JSON.stringify({ lostItemId, plan }) }),
  getBoost: (id) => apiRequest(`/api/boosts/${id}`),
  claimBoostPaid: (id, note) => apiRequest(`/api/boosts/${id}/paid`, { method: "POST", body: JSON.stringify({ note: note || undefined }) }),
  cancelBoost: (id) => apiRequest(`/api/boosts/${id}/cancel`, { method: "POST" }),
  getAdminBoosts: () => apiRequest("/api/boosts/admin"),
  saveBoostPaymentDetails: (body) => apiRequest("/api/boosts/admin/settings", { method: "PUT", body: JSON.stringify(body) }),
  approveBoost: (id) => apiRequest(`/api/boosts/admin/${id}/approve`, { method: "POST" }),
  rejectBoost: (id, reason) => apiRequest(`/api/boosts/admin/${id}/reject`, { method: "POST", body: JSON.stringify({ reason: reason || undefined }) }),

  // Tokens
  getTokenLedger: () => apiRequest("/api/tokens/ledger"),
  getCashoutRequests: () => apiRequest("/api/tokens/cashout-requests"),
  cashoutTokens: (body) => apiRequest("/api/tokens/cashout", { method: "POST", body: JSON.stringify(body) }),
  getLeaderboard: () => apiRequest("/api/tokens/leaderboard"),

  // Community
  getMyBadges: () => apiRequest("/api/users/me/badges"),
  getMyNotes: () => apiRequest("/api/users/me/notes"),
  getReunitedItems: () => apiRequest("/api/found-items?status=reunited"),

  // Admin
  getAdminCashoutRequests: (status) =>
    apiRequest(`/api/admin/cashout-requests${status ? `?status=${status}` : ""}`),
  updateAdminCashoutRequest: (id, status) =>
    apiRequest(`/api/admin/cashout-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getAdminStats: () => apiRequest("/api/admin/stats"),
  getAdminReports: (status) => apiRequest(`/api/admin/reports${status ? `?status=${status}` : ""}`),
  updateAdminReport: (id, action) =>
    apiRequest(`/api/admin/reports/${id}`, { method: "PATCH", body: JSON.stringify({ action }) }),
  unsuspendUser: (id) => apiRequest(`/api/admin/users/${id}/unsuspend`, { method: "PATCH" }),

  // Reports
  createReport: (body) => apiRequest("/api/reports", { method: "POST", body: JSON.stringify(body) }),

  // Push
  getVapidPublicKey: () => apiRequest("/api/push/vapid-public-key"),
  subscribePush: (subscription) =>
    apiRequest("/api/push/subscribe", { method: "POST", body: JSON.stringify(subscription) }),
  unsubscribePush: (endpoint) =>
    apiRequest("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint }) }),
  getPushPreferences: () => apiRequest("/api/push/preferences"),
  updatePushPreferences: (body) =>
    apiRequest("/api/push/preferences", { method: "PATCH", body: JSON.stringify(body) }),
};

export function resolvePhotoUrl(url) {
  if (!url) return url;
  return url.startsWith("/") ? `${API_BASE_URL}${url}` : url;
}

export { getStoredTokens, setStoredTokens, clearStoredTokens, getStoredUser, setStoredUser, API_BASE_URL };
