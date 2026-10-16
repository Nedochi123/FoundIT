// Counts wrong sign-in attempts per ACCOUNT (not just per connection), so guessing one student's password from many addresses at
// once still gets nowhere: after `max` wrong attempts that account refuses sign-in until `windowMs` has passed (the right
// password included, or the guesser could keep trying). Kept in memory, so it starts fresh when the server restarts.
function createThrottle({ max = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const fails = new Map(); // key -> { count, since }
  const fresh = (f, now) => f && now - f.since <= windowMs;
  return {
    isLocked(key, now = Date.now()) {
      const f = fails.get(key);
      if (!fresh(f, now)) {
        fails.delete(key);
        return false;
      }
      return f.count >= max;
    },
    recordFail(key, now = Date.now()) {
      if (fails.size > 5000) for (const [k, f] of fails) if (!fresh(f, now)) fails.delete(k); // never grows without end
      const f = fails.get(key);
      if (fresh(f, now)) f.count += 1;
      else fails.set(key, { count: 1, since: now });
    },
    clear(key) {
      fails.delete(key);
    },
  };
}

module.exports = { createThrottle };
