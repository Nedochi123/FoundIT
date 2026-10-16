// A phone's push subscription says "send my notifications to this web address". The server later POSTs to that address, so it must
// be a real push service and nothing else: otherwise any signed-in account could make the server send requests to any address it
// likes (including ones only the server can reach, such as other services on its private network).
// Browsers only ever hand out addresses on the push services below, always over https and the normal port.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge, Android
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/, // Safari, iPhone
  /(^|\.)notify\.windows\.com$/, // Windows
];
const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

function validEndpoint(value) {
  if (typeof value !== "string" || value.length > 1200) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" && url.port === "" && !url.username && !url.password && PUSH_HOSTS.some((re) => re.test(url.hostname));
}

/** { endpoint, keys: { p256dh, auth } } with every part checked, or null. */
function cleanSubscription(body) {
  if (!body || typeof body !== "object" || !validEndpoint(body.endpoint)) return null;
  const { p256dh, auth } = body.keys ?? {};
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (p256dh.length < 40 || p256dh.length > 200 || auth.length < 10 || auth.length > 60 || !B64URL.test(p256dh) || !B64URL.test(auth)) return null;
  return { endpoint: body.endpoint, keys: { p256dh, auth } };
}

module.exports = { validEndpoint, cleanSubscription };
