// Idempotent schema. Safe to run on every cold start.
export const schemaSql = /* sql */ `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  telegram_id   BIGINT UNIQUE,
  is_guest      BOOLEAN NOT NULL DEFAULT FALSE,
  username      TEXT,
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT,
  avatar_url    TEXT,
  language      TEXT NOT NULL DEFAULT 'en',
  virtual_coins INTEGER NOT NULL DEFAULT 0 CHECK (virtual_coins >= 0),
  xp            INTEGER NOT NULL DEFAULT 0,
  level         INTEGER NOT NULL DEFAULT 1,
  streak_days   INTEGER NOT NULL DEFAULT 0,
  last_seen_date DATE,
  last_open_at  TIMESTAMPTZ,
  blocked       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collections (
  id         SERIAL PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Images live in object storage / static CDN; only URLs are stored here.
-- virtual_price is a fictional in-app value: never purchasable, sellable or withdrawable.
CREATE TABLE IF NOT EXISTS skins (
  id                  SERIAL PRIMARY KEY,
  slug                TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  weapon_name         TEXT NOT NULL,
  weapon_type         TEXT NOT NULL CHECK (weapon_type IN ('rifle','smg','pistol','sniper','shotgun','knife','gloves')),
  rarity              TEXT NOT NULL CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  image_url           TEXT NOT NULL,
  optimized_image_url TEXT,
  thumbnail_url       TEXT,
  description         TEXT NOT NULL DEFAULT '',
  virtual_price       INTEGER NOT NULL DEFAULT 1 CHECK (virtual_price > 0 AND virtual_price <= 10000000),
  collection_id       INTEGER REFERENCES collections(id) ON DELETE SET NULL,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  featured            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS skins_collection_idx ON skins(collection_id);

CREATE TABLE IF NOT EXISTS cases (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image       TEXT NOT NULL,
  accent      TEXT NOT NULL DEFAULT '#7c8cff',
  cost        INTEGER NOT NULL CHECK (cost >= 0),
  featured    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fixed, admin-visible drop weights per case. No hidden modifiers exist anywhere.
CREATE TABLE IF NOT EXISTS case_items (
  case_id  INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  skin_id  INTEGER NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
  weight   INTEGER NOT NULL CHECK (weight > 0),
  PRIMARY KEY (case_id, skin_id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skin_id    INTEGER NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  favorite    BOOLEAN NOT NULL DEFAULT FALSE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, skin_id)
);
CREATE INDEX IF NOT EXISTS inventory_user_idx ON inventory(user_id);

CREATE TABLE IF NOT EXISTS openings (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id    INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  skin_id    INTEGER NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
  cost       INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS openings_user_idx ON openings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS openings_created_idx ON openings(created_at DESC);

CREATE TABLE IF NOT EXISTS missions (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL CHECK (type IN ('open_case','view_skins','claim_daily','complete_profile','login_streak')),
  target      INTEGER NOT NULL DEFAULT 1 CHECK (target > 0),
  reward      INTEGER NOT NULL DEFAULT 0 CHECK (reward >= 0),
  period      TEXT NOT NULL DEFAULT 'daily' CHECK (period IN ('daily','weekly','once')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_missions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id   INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  period_key   TEXT NOT NULL,
  progress     INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  claimed_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_id, period_key)
);

CREATE TABLE IF NOT EXISTS daily_rewards (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_date DATE NOT NULL,
  amount     INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, claim_date)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  telegram_id   BIGINT UNIQUE,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner','admin','viewer')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id          TEXT PRIMARY KEY,            -- sha256 of the opaque cookie token
  admin_id    INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  csrf_token  TEXT NOT NULL,
  user_agent  TEXT,
  ip          TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id         SERIAL PRIMARY KEY,
  admin_id   INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  details    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_logs_created_idx ON admin_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS uploads (
  id            TEXT PRIMARY KEY,
  original_url  TEXT NOT NULL,
  optimized_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  mime          TEXT NOT NULL,
  size          INTEGER NOT NULL,
  width         INTEGER,
  height        INTEGER,
  created_by    INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
