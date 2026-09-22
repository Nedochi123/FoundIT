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

CREATE TABLE IF NOT EXISTS lost_items (
  id           TEXT PRIMARY KEY,
  poster_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  location     TEXT,
  status       TEXT NOT NULL DEFAULT 'open',
  resolved_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lost_items_poster ON lost_items(poster_id);
CREATE INDEX IF NOT EXISTS idx_lost_items_status ON lost_items(status);

-- Name/ID number are deliberately NOT columns here — they live on users
-- (poster_id join) since the product decision is to fill id_number once
-- and never re-ask it per post.
CREATE TABLE IF NOT EXISTS found_items (
  id           TEXT PRIMARY KEY,
  poster_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_url    TEXT NOT NULL,
  description  TEXT,
  location     TEXT,
  status       TEXT NOT NULL DEFAULT 'open',
  resolved_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
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
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
