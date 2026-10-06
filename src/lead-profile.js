// src/lead-profile.js
// Sanitise a free-form lead/onboarding "profile" object sent by any tenant's
// capture form before it is merged into customers.profile. Pure, no IO.

export const PROFILE_MAX_KEYS = 24;
export const PROFILE_MAX_KEY_LENGTH = 40;
export const PROFILE_MAX_VALUE_LENGTH = 500;
export const PROFILE_MAX_LIST_ITEMS = 12;

const KEY_RE = /^[a-z][a-z0-9_]*$/;

function cleanString(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > PROFILE_MAX_VALUE_LENGTH
    ? s.slice(0, PROFILE_MAX_VALUE_LENGTH)
    : s;
}

/**
 * Returns a plain object with snake_case keys and string / string[] / boolean /
 * finite-number values only. Unknown shapes are dropped. Empty result → {}.
 */
export function sanitizeProfile(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out = {};
  for (const [rawKey, rawVal] of Object.entries(input)) {
    if (Object.keys(out).length >= PROFILE_MAX_KEYS) break;
    const key = String(rawKey || "")
      .trim()
      .toLowerCase();
    if (!key || key.length > PROFILE_MAX_KEY_LENGTH || !KEY_RE.test(key))
      continue;

    if (typeof rawVal === "boolean") {
      out[key] = rawVal;
    } else if (typeof rawVal === "number") {
      if (Number.isFinite(rawVal)) out[key] = rawVal;
    } else if (Array.isArray(rawVal)) {
      const list = rawVal
        .map(cleanString)
        .filter(Boolean)
        .slice(0, PROFILE_MAX_LIST_ITEMS);
      if (list.length) out[key] = list;
    } else if (typeof rawVal === "string") {
      const s = cleanString(rawVal);
      if (s) out[key] = s;
    }
  }
  return out;
}

export function hasProfile(profile) {
  return Boolean(profile) && Object.keys(profile).length > 0;
}
