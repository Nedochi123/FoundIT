// Stops other websites from making a signed-in student's browser do things.
//
// The app knows who is signed in from a cookie, and a browser sends that cookie along even when ANOTHER website's page
// makes the request (the app and this server live at different addresses, so the cookie has to be allowed across sites).
// CORS only stops that page from READING the answer: a plain form post or a body-less POST (confirm, approve, "I received
// it"...) still goes through. Browsers always say which site a request came from, so any change (POST, PUT, PATCH,
// DELETE) that names a site we do not serve is refused here.
//
// Allowed: the app's own addresses (the same list CORS uses), this server's own address (the owner page is served from
// here), and requests that name no site at all (the phone app's native requests, curl, tests): those cannot be forged by
// a web page, because a browser always adds the header.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function originGuard(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get("origin");
    if (origin !== undefined) {
      let host = null;
      try {
        host = new URL(origin).host;
      } catch {
        /* "null" (a sandboxed page) or nonsense: refused below */
      }
      if (allowed.has(origin) || (host && host === req.get("host"))) return next();
      return res.status(403).json({ error: "This request is not allowed from another site." });
    }
    // some browsers leave Origin off but still say where a request came from
    if (req.get("sec-fetch-site") === "cross-site") {
      return res.status(403).json({ error: "This request is not allowed from another site." });
    }
    next();
  };
}

module.exports = { originGuard };
