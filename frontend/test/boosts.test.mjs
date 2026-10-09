// The little time helpers shown on boosted posts and notifications. SQLite stores times in UTC as
// "YYYY-MM-DD HH:MM:SS" (no zone), which is easy to misread as local time, so that is checked here.
import test from "node:test";
import assert from "node:assert/strict";
import { timeLeft, timeAgo } from "../src/lib/boosts.js";

const sqlite = (date) => date.toISOString().slice(0, 19).replace("T", " ");
const later = (ms) => sqlite(new Date(Date.now() + ms));
const earlier = (ms) => sqlite(new Date(Date.now() - ms));
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

test("timeLeft counts down in days, hours and minutes", () => {
  assert.equal(timeLeft(later(2 * DAY + 4 * HOUR + 30_000)), "2 days 4 hours left");
  assert.equal(timeLeft(later(DAY + 30_000)), "1 day left");
  assert.equal(timeLeft(later(5 * HOUR + 30_000)), "5 hours left");
  assert.equal(timeLeft(later(HOUR + 30_000)), "1 hour left");
  assert.equal(timeLeft(later(30 * MIN + 30_000)), "30 minutes left");
  assert.equal(timeLeft(later(20_000)), "1 minute left");
});

test("timeLeft says so when the time has passed", () => {
  assert.equal(timeLeft(earlier(5 * MIN)), "ending now");
});

test("timeAgo reads the stored time as UTC", () => {
  assert.equal(timeAgo(earlier(10_000)), "just now");
  assert.equal(timeAgo(earlier(5 * MIN + 10_000)), "5m ago");
  assert.equal(timeAgo(earlier(3 * HOUR + 10_000)), "3h ago");
  assert.equal(timeAgo(earlier(2 * DAY + 10_000)), "2d ago");
});
