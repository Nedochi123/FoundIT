// Several requests that fail at the same moment (a screen asks for five things as the 15-minute session runs out) must share ONE
// session renewal: the refresh token works only once, so renewing separately logged the student out.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRefreshGate } from "../src/lib/refreshGate.js";

const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

test("callers that arrive while a renewal is running share it, and all get its answer", async () => {
  const once = createRefreshGate();
  let renewals = 0;
  const renew = async () => {
    renewals++;
    await tick(20);
    return { accessToken: "new" };
  };
  const results = await Promise.all(Array.from({ length: 10 }, () => once(renew)));
  assert.equal(renewals, 1);
  assert.ok(results.every((r) => r.accessToken === "new"));
});

test("once a renewal is over, the next expiry starts a fresh one", async () => {
  const once = createRefreshGate();
  let renewals = 0;
  const renew = async () => ++renewals;
  assert.equal(await once(renew), 1);
  assert.equal(await once(renew), 2);
});

test("a failed renewal fails for everyone waiting on it, then the gate is open again", async () => {
  const once = createRefreshGate();
  let tries = 0;
  const failing = async () => {
    tries++;
    await tick(10);
    throw new Error("expired");
  };
  const outcomes = await Promise.allSettled([once(failing), once(failing), once(failing)]);
  assert.equal(tries, 1);
  assert.ok(outcomes.every((o) => o.status === "rejected"));
  assert.equal(await once(async () => "ok"), "ok");
});

test("a renewal that throws at once (not async) is still shared and still releases the gate", async () => {
  const once = createRefreshGate();
  const boom = () => {
    throw new Error("sync failure");
  };
  const outcomes = await Promise.allSettled([once(boom), once(boom)]);
  assert.ok(outcomes.every((o) => o.status === "rejected"));
  assert.equal(await once(() => 7), 7);
});

test("the app's request function uses the gate, and only signs out when no newer login was stored", () => {
  const api = readFileSync(new URL("../src/lib/api.js", import.meta.url), "utf8");
  assert.match(api, /createRefreshGate/);
  assert.match(api, /await refreshOnce\(/);
  assert.match(api, /getStoredTokens\(\)\?\.refreshToken === tokens\?\.refreshToken/, "must not wipe a login another request just renewed");
  // the old pattern: each failed request renewing by itself
  assert.ok(!/const refreshed = await apiRequest\(\s*"\/api\/auth\/refresh"/.test(api), "no request may renew on its own");
});
