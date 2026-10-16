// How long a sign-in token (a JWT) has left, read from the token itself. Used to renew the session just BEFORE it expires: a request
// sent with an expired token is refused by the server, and the browser prints every refused request as a red "Failed to load
// resource" line in the console even though the app then quietly renews and retries. The token is only read here, never trusted:
// the server still checks every token it receives.

/** Seconds until the token expires (negative once it has), or Infinity when it cannot be read (then nothing is renewed early). */
export function secondsLeft(token, now = Date.now()) {
  try {
    const part = String(token).split(".")[1];
    if (!part) return Infinity;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const exp = JSON.parse(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4))).exp;
    return Number.isFinite(exp) ? exp - now / 1000 : Infinity;
  } catch {
    return Infinity;
  }
}

/** A token with less than this many seconds left is renewed before it is used. */
export const RENEW_BEFORE_SECONDS = 30;
