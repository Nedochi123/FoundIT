// The phone's location is only ever attached to requests while it is fresh, and the "why is it off" reasons are
// told apart so the location screen can show the right help.
import test from "node:test";
import assert from "node:assert/strict";

const setGeolocation = (impl) => Object.defineProperty(globalThis.navigator, "geolocation", { configurable: true, value: impl });
const removeGeolocation = () => delete globalThis.navigator.geolocation;
const fix = (latitude, longitude, accuracy) => ({ coords: { latitude, longitude, accuracy } });

const { readPosition, geoHeaderValue, geoSupported } = await import("../src/lib/geo.js");

test("there is no location header until a position has been read", () => {
  assert.equal(geoHeaderValue(), null);
});

test("a position read is sent as lat,lng,accuracy", async () => {
  setGeolocation({ getCurrentPosition: (ok) => ok(fix(9.0784567, 7.3985123, 21.6)) });
  const result = await readPosition();
  assert.equal(result.ok, true);
  assert.equal(geoHeaderValue(), "9.07846,7.39851,22");
});

test("a stale position is not sent", async (t) => {
  setGeolocation({ getCurrentPosition: (ok) => ok(fix(9.1, 7.4, 10)) });
  await readPosition();
  assert.ok(geoHeaderValue());
  const realNow = Date.now;
  t.after(() => (Date.now = realNow));
  Date.now = () => realNow() + 16 * 60 * 1000;
  assert.equal(geoHeaderValue(), null, "older than 15 minutes");
});

test("why a position couldn't be read is told apart", async () => {
  for (const [code, reason] of [[1, "denied"], [2, "unavailable"], [3, "timeout"]]) {
    setGeolocation({ getCurrentPosition: (ok, fail) => fail({ code }) });
    assert.deepEqual(await readPosition(), { ok: false, reason });
  }
  removeGeolocation();
  assert.equal(geoSupported(), false);
  assert.deepEqual(await readPosition(), { ok: false, reason: "unsupported" });
});
