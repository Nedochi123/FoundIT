// A session is renewed just before it runs out, so no request is ever sent with an expired token (the server would refuse it and the
// browser would print a red "Failed to load resource" line for each one).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RENEW_BEFORE_SECONDS, secondsLeft } from "../src/lib/tokenExpiry.js";

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const jwt = (payload) => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.signature`;
const NOW = Date.UTC(2026, 9, 16, 12, 0, 0);
const at = (secondsFromNow) => Math.floor(NOW / 1000) + secondsFromNow;

test("reads how long a token has left from the token itself", () => {
  assert.equal(secondsLeft(jwt({ exp: at(900) }), NOW), 900);
  assert.equal(secondsLeft(jwt({ exp: at(10) }), NOW), 10);
  assert.equal(secondsLeft(jwt({ exp: at(-60) }), NOW), -60); // already expired: negative
});

test("works for the base64url a real token uses (with - and _ and no padding)", () => {
  // a payload whose base64 contains characters that differ between base64 and base64url
  const payload = { exp: at(500), name: "Ọmọ ?>>~~ Ṣade" };
  const token = jwt(payload);
  assert.match(token.split(".")[1], /^[A-Za-z0-9_-]+$/);
  assert.equal(secondsLeft(token, NOW), 500);
});

test("anything that is not a readable token gives Infinity, so nothing is renewed early on a guess", () => {
  for (const bad of ["", "abc", "a.b", "a.!!!.c", jwt({}), jwt({ exp: "soon" }), jwt({ exp: null }), `${b64url({})}.${Buffer.from("not json").toString("base64url")}.x`, null, undefined, 42, {}]) {
    assert.equal(secondsLeft(bad, NOW), Infinity, String(bad).slice(0, 40));
  }
});

test("a token with less than the margin left is due for renewal, one with more is not", () => {
  const due = (t) => secondsLeft(t, NOW) < RENEW_BEFORE_SECONDS;
  assert.equal(RENEW_BEFORE_SECONDS, 30);
  assert.equal(due(jwt({ exp: at(-5) })), true);
  assert.equal(due(jwt({ exp: at(29) })), true);
  assert.equal(due(jwt({ exp: at(31) })), false);
  assert.equal(due(jwt({ exp: at(900) })), false);
});

test("the request function renews before sending, never for the sign-in/renewal routes themselves, and falls back if renewal fails", () => {
  const api = readFileSync(new URL("../src/lib/api.js", import.meta.url), "utf8");
  const start = api.indexOf("async function apiRequest");
  const head = api.slice(start, start + 1400);
  assert.match(head, /secondsLeft\(tokens\.accessToken\) < RENEW_BEFORE_SECONDS/);
  assert.match(head, /!NO_REFRESH_RETRY_PATHS\.has\(path\)/, "the renewal/sign-in routes must not renew themselves");
  assert.match(head, /!_isRetry/, "a retry must not renew again");
  assert.match(head, /\.catch\(\(\) => null\)/, "a failed early renewal must not stop the request");
  assert.match(head, /refreshOnce\(/, "early renewals share the same single renewal as late ones");
});
