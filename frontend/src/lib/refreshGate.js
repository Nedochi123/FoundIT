// When a student's 15-minute session expires, a screen that loads several things at once (Home asks for five) gets several
// "expired" answers at the same moment. Each one used to try to renew the session by itself with the SAME refresh token, which
// the server accepts only once: the first renewal won, the rest failed, and those failures then wiped the freshly renewed login.
// The gate makes every caller that arrives while a renewal is running wait for that one renewal and share its result.
export function createRefreshGate() {
  let inFlight = null;
  return function once(refresh) {
    if (!inFlight) {
      inFlight = Promise.resolve()
        .then(refresh)
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  };
}
