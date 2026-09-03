-- ============================================================
-- Mini-App Platform Tables — PostgreSQL
-- Run: node src/scripts/migrate.js --file 004_create_miniapp_tables
-- ============================================================

-- Developer-submitted mini-apps. `manifest` holds the full submitted JSON
-- (forward-compatible with fields we don't query directly yet); the
-- columns below are the denormalized subset we filter/sort/join on.
CREATE TABLE IF NOT EXISTS miniapps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              VARCHAR(64)   NOT NULL UNIQUE,
  name              VARCHAR(100)  NOT NULL,
  tagline           VARCHAR(140),
  description       TEXT,
  icon_url          TEXT,
  banner_url        TEXT,
  category          VARCHAR(50)   NOT NULL DEFAULT 'games',
  url               TEXT          NOT NULL,          -- entry point loaded into the WebView
  origin_whitelist  TEXT          NOT NULL,           -- must match `url`'s origin
  requested_scopes  JSONB         NOT NULL DEFAULT '[]'::jsonb,
  manifest          JSONB         NOT NULL DEFAULT '{}'::jsonb,
  manifest_version  VARCHAR(20)   NOT NULL DEFAULT '1.0.0',
  sdk_version       VARCHAR(20),                      -- BRIDGE_VERSION the app was built against
  developer_id      VARCHAR(128)  NOT NULL,            -- Firebase UID
  developer_name    VARCHAR(100),
  status            VARCHAR(20)   NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'suspended')),
  review_notes      TEXT,                              -- reviewer-facing reason on reject/suspend
  reviewed_by        VARCHAR(128),
  reviewed_at         TIMESTAMPTZ,
  featured          BOOLEAN       NOT NULL DEFAULT FALSE,
  install_count     INTEGER       NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Per-guild installs. A guild owner/moderator chooses which of the app's
-- *requested* scopes to actually grant — install-time consent, not an
-- automatic all-or-nothing grant of whatever the developer asked for.
CREATE TABLE IF NOT EXISTS guild_miniapps (
  guild_id        UUID          NOT NULL REFERENCES guilds(id)   ON DELETE CASCADE,
  miniapp_id      UUID          NOT NULL REFERENCES miniapps(id) ON DELETE CASCADE,
  granted_scopes  JSONB         NOT NULL DEFAULT '[]'::jsonb,
  installed_by    VARCHAR(128)  NOT NULL,
  installed_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guild_id, miniapp_id)
);

-- Per-user key/value save data for a mini-app (bridge method storage.get/set)
-- — e.g. a game's high score or progress. Scoped per-app, per-user; NOT
-- per-guild, so progress follows the player across guilds that install it.
CREATE TABLE IF NOT EXISTS miniapp_storage (
  miniapp_id  UUID          NOT NULL REFERENCES miniapps(id) ON DELETE CASCADE,
  user_id     VARCHAR(128)  NOT NULL,
  key         VARCHAR(100)  NOT NULL,
  value       JSONB         NOT NULL,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (miniapp_id, user_id, key)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_miniapps_status         ON miniapps(status);
CREATE INDEX IF NOT EXISTS idx_miniapps_category        ON miniapps(category) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_miniapps_featured        ON miniapps(featured) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_miniapps_developer_id    ON miniapps(developer_id);
CREATE INDEX IF NOT EXISTS idx_miniapps_name_fts        ON miniapps USING gin(to_tsvector('english', name || ' ' || coalesce(tagline, '')));

CREATE INDEX IF NOT EXISTS idx_guild_miniapps_miniapp_id ON guild_miniapps(miniapp_id);

CREATE INDEX IF NOT EXISTS idx_miniapp_storage_user      ON miniapp_storage(miniapp_id, user_id);
