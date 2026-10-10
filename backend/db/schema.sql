PRAGMA foreign_keys = ON;

-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  email              TEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  id_number          TEXT,
  email_verified_at  TEXT,
  tokens             INTEGER NOT NULL DEFAULT 0,
  suspended_at       TEXT,
  deleted_at         TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id         TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

-- ============================================================
-- LOST & FOUND ITEMS
-- ============================================================

-- expired_at is stamped by the daily auto-expiry job when a stale open
-- item gets silently marked resolved (see src/utils/expireItems.js) —
-- kept distinct from resolved_at so "someone actually resolved this" is
-- always distinguishable from "this just aged out."
-- category is a small fixed set (see idNumber-style shared constant in
-- utils/itemCategories.js) shown as a quick-pick at posting time and an
-- icon on each card — nullable since it was added after launch and
-- older rows won't have one.
CREATE TABLE IF NOT EXISTS lost_items (
  id           TEXT PRIMARY KEY,
  poster_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  location     TEXT,
  category     TEXT,
  status       TEXT NOT NULL DEFAULT 'open',
  resolved_at  TEXT,
  expired_at   TEXT,
  -- "Urgently need" posts: the reward the poster promised the finder (one of utils/rewards.js), when they
  -- made the alert, and when they ticked the agreement to pay it. NULL on ordinary lost posts.
  urgent_reward    INTEGER,
  urgent_at        TEXT,
  urgent_agreed_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lost_items_poster ON lost_items(poster_id);
CREATE INDEX IF NOT EXISTS idx_lost_items_status ON lost_items(status);

-- Name/ID number are deliberately NOT columns here — they live on users
-- (poster_id join) since the product decision is to fill id_number once
-- and never re-ask it per post.
-- return_confirmed_at is distinct from resolved_at: resolved_at can be
-- set unilaterally by the finder (PATCH /:id/resolve, just tidies the
-- gallery), while return_confirmed_at is only ever set by the seeker
-- confirming in their conversation — that's the one that pays out
-- tokens, since a finder marking their own post resolved proves nothing
-- and would be trivial to fake for a token farm.
CREATE TABLE IF NOT EXISTS found_items (
  id                    TEXT PRIMARY KEY,
  poster_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_url             TEXT NOT NULL,
  description           TEXT,
  location              TEXT,
  category              TEXT,
  status                TEXT NOT NULL DEFAULT 'open',
  resolved_at           TEXT,
  return_confirmed_at   TEXT,
  expired_at            TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_found_items_poster ON found_items(poster_id);
CREATE INDEX IF NOT EXISTS idx_found_items_status ON found_items(status);

-- ============================================================
-- IN-APP MESSAGING (polling-based, no websockets)
-- ============================================================

-- One conversation per (found_item, seeker) pair — re-clicking "Message"
-- on the same item reuses the existing conversation instead of spawning
-- duplicates. finder_id is denormalized from found_items.poster_id at
-- creation time so "list my conversations" doesn't need to join
-- found_items on every poll; it can never drift since found items have
-- no ownership-transfer feature.
CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  found_item_id TEXT NOT NULL REFERENCES found_items(id) ON DELETE CASCADE,
  finder_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seeker_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(found_item_id, seeker_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_finder ON conversations(finder_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seeker ON conversations(seeker_id);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  read_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

-- ============================================================
-- WEB PUSH
-- ============================================================

-- endpoint is UNIQUE (not per-user) because the same browser/device can
-- end up POSTing the same subscription twice (re-prompted, reinstalled
-- PWA, logged out and back in) — upserting on endpoint avoids either a
-- duplicate row or a constraint error, and always keeps it pointed at
-- whichever user most recently subscribed on that device.
-- notify_lost / notify_found let a student opt out of one broadcast
-- category without disabling push entirely — default to both on, since
-- that matches what "Enable notifications" already promises.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  notify_lost  INTEGER NOT NULL DEFAULT 1,
  notify_found INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- ============================================================
-- TOKENS & CASH-OUT
-- ============================================================

-- Withdrawal requests only — no automated payout integration. A request
-- lands here as 'pending' and gets paid out manually (bank transfer)
-- by the site owner, who flips it to 'paid' directly in the database.
CREATE TABLE IF NOT EXISTS cashout_requests (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tokens_spent    INTEGER NOT NULL,
  amount_naira    INTEGER NOT NULL,
  bank_name       TEXT NOT NULL,
  account_number  TEXT NOT NULL,
  account_name    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_cashout_requests_user ON cashout_requests(user_id);

-- Full running history behind users.tokens — every award and cash-out
-- lands a row here, so a balance is always reconstructable/auditable
-- rather than just a single mutable counter.
CREATE TABLE IF NOT EXISTS token_ledger (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta          INTEGER NOT NULL,
  reason         TEXT NOT NULL,
  note           TEXT NOT NULL,
  found_item_id  TEXT REFERENCES found_items(id) ON DELETE SET NULL,
  cashout_id     TEXT REFERENCES cashout_requests(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_token_ledger_user ON token_ledger(user_id, created_at);

-- ============================================================
-- MODERATION
-- ============================================================

-- target_id is a plain TEXT id (no foreign key) because it points into
-- different tables depending on target_type ('found_item' | 'lost_item'
-- | 'user') -- a single FK can't span three target tables. Resolving
-- what it points to is the admin route's job.
CREATE TABLE IF NOT EXISTS reports (
  id            TEXT PRIMARY KEY,
  reporter_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type   TEXT NOT NULL,
  target_id     TEXT NOT NULL,
  reason        TEXT NOT NULL,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- ============================================================
-- COMMUNITY / RECOGNITION
-- ============================================================

-- One optional note per confirmed return, written by the seeker right
-- when they confirm it — shown on the finder's own profile as "notes
-- you've received" (there's no other-user-profile view to show it on
-- the finder's page publicly, so it surfaces on their own instead).
CREATE TABLE IF NOT EXISTS thank_you_notes (
  id             TEXT PRIMARY KEY,
  found_item_id  TEXT NOT NULL REFERENCES found_items(id) ON DELETE CASCADE,
  from_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note           TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_thank_you_notes_to_user ON thank_you_notes(to_user_id, created_at);

-- ============================================================
-- REWARDS (a voluntary thank-you from the owner to the finder)
-- ============================================================

-- FoundIT never handles this money: the owner pays the finder directly
-- (bank transfer) after the finder shares their details privately in the
-- chat. This table only records the amount the owner chose and how far it
-- got: promised -> sent (owner says they paid) -> received (finder says it
-- arrived). One reward per found item, and only after the return is
-- confirmed. No bank or card details are stored here.
CREATE TABLE IF NOT EXISTS rewards (
  id              TEXT PRIMARY KEY,
  found_item_id   TEXT NOT NULL UNIQUE REFERENCES found_items(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  from_user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount          INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'promised',
  sent_at         TEXT,
  received_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rewards_conversation ON rewards(conversation_id);
CREATE INDEX IF NOT EXISTS idx_rewards_to_user ON rewards(to_user_id, created_at);

-- ============================================================
-- QR TAGS ("Return me" stickers)
-- ============================================================

-- A sticker is printed with a QR code pointing at /t/<code>. Until a student activates it, owner_id is
-- NULL (status 'unclaimed'). Whoever finds the tagged item scans it and starts a private chat with the
-- owner without an account: the finder is identified only by a secret token kept in their browser (only
-- its hash is stored). Neither side sees the other's name or number unless they choose to share it in
-- the chat (a 'contact' message). Releasing a tag deletes its chats.
CREATE TABLE IF NOT EXISTS tags (
  id         TEXT PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  owner_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  label      TEXT,
  status     TEXT NOT NULL DEFAULT 'unclaimed',
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tags_owner ON tags(owner_id);

-- One chat per scanning person (a different finder, or the same one after clearing their browser, starts
-- a new one).
CREATE TABLE IF NOT EXISTS tag_threads (
  id                TEXT PRIMARY KEY,
  tag_id            TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  finder_token_hash TEXT NOT NULL UNIQUE,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tag_threads_tag ON tag_threads(tag_id, created_at);

-- kind 'text' is an ordinary message; kind 'contact' is "here is my name and/or number", sent on purpose.
CREATE TABLE IF NOT EXISTS tag_messages (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL REFERENCES tag_threads(id) ON DELETE CASCADE,
  sender        TEXT NOT NULL CHECK (sender IN ('finder', 'owner')),
  kind          TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'contact')),
  body          TEXT,
  contact_name  TEXT,
  contact_phone TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  read_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_tag_messages_thread ON tag_messages(thread_id, created_at);

-- ============================================================
-- BOOSTS (paid, so a lost post gets seen)
-- ============================================================

-- Small key/value settings an admin can change without a deploy. 'boost_payment' holds the bank account
-- students pay boosts into (typed in by the admin; never set from code).
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A student pays to pin their lost post to the top of the Lost board and to Home for a while, plus one alert to
-- everyone. Payment is a bank transfer the admin checks by hand (same idea as cash-outs):
--   awaiting_payment -> payment_claimed (student taps "I've paid") -> active (admin approves) | rejected
-- or cancelled (student backs out, or it sat unpaid for 2 days). 'active' with an expires_at in the past simply
-- means the boost has ended. reference is what the student writes in the transfer so the admin can match it.
CREATE TABLE IF NOT EXISTS boosts (
  id              TEXT PRIMARY KEY,
  lost_item_id    TEXT NOT NULL REFERENCES lost_items(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan            TEXT NOT NULL,
  hours           INTEGER NOT NULL,
  amount          INTEGER NOT NULL,
  reference       TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'awaiting_payment',
  payer_note      TEXT,
  paid_claimed_at TEXT,
  approved_at     TEXT,
  starts_at       TEXT,
  expires_at      TEXT,
  decided_by      TEXT,
  reject_reason   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_boosts_item ON boosts(lost_item_id, status);
CREATE INDEX IF NOT EXISTS idx_boosts_user ON boosts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_boosts_status ON boosts(status, created_at);

-- ============================================================
-- SECURITY: ACTIVITY LOG (owner-only view; see utils/monitor.js)
-- ============================================================

-- One row per thing a student did that changed something (posted, messaged, confirmed a return...) plus one
-- when the app is opened. Never the content of a request (no passwords, no message text: chats are read from
-- the messages table). lat/lng are rounded to about 11 m and come from the phone location when the app sent
-- it; NULL means none was sent. Rows older than 90 days are deleted; deleting an account deletes its rows.
CREATE TABLE IF NOT EXISTS activity_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  detail      TEXT,
  target_type TEXT,
  target_id   TEXT,
  lat         REAL,
  lng         REAL,
  accuracy    INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id, created_at);

-- Every time the owner opens a chat in the monitor, so access to private messages is accountable.
CREATE TABLE IF NOT EXISTS monitor_access_log (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  what       TEXT NOT NULL,
  target_id  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
