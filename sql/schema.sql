-- ============================================================
--  Salam Fintech AI — PostgreSQL Schema
--  Production-ready | All tables, enums, indexes, triggers
-- ============================================================

-- ------------------------------------------------------------
--  Extensions
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
--  ENUMS
-- ============================================================

CREATE TYPE user_status AS ENUM (
  'active',
  'disabled',
  'deleted'
);

CREATE TYPE transaction_type AS ENUM (
  'expense',
  'income'
);

CREATE TYPE transaction_source AS ENUM (
  'manual',
  'ai_parsed',
  'imported',
  'file_extracted'
);

CREATE TYPE raw_note_status AS ENUM (
  'pending',
  'parsed',
  'failed',
  'ignored'
);

CREATE TYPE conversation_status AS ENUM (
  'active',
  'archived',
  'deleted'
);

CREATE TYPE message_role AS ENUM (
  'user',
  'assistant',
  'system',
  'tool'
);

CREATE TYPE message_status AS ENUM (
  'sent',
  'processing',
  'completed',
  'failed'
);

CREATE TYPE file_status AS ENUM (
  'pending',
  'uploaded',
  'deleted'
);


-- ============================================================
--  TRIGGER FUNCTION — auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
--  TABLE: users
-- ============================================================

CREATE TABLE users (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email            VARCHAR(255) NOT NULL UNIQUE,
  password_hash    TEXT         NOT NULL,
  name             VARCHAR(120),
  default_currency CHAR(3)      NOT NULL DEFAULT 'USD',
  locale           VARCHAR(10)  NOT NULL DEFAULT 'en',
  timezone         VARCHAR(80)  NOT NULL DEFAULT 'UTC',
  status           user_status  NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email  ON users (email);
CREATE INDEX idx_users_status ON users (status);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
--  TABLE: refresh_tokens
-- ============================================================

CREATE TABLE refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id    ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);


-- ============================================================
--  TABLE: conversations
-- ============================================================

CREATE TABLE conversations (
  id              UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID               NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title           VARCHAR(255)       NOT NULL DEFAULT 'New Chat',
  status          conversation_status NOT NULL DEFAULT 'active',
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id      ON conversations (user_id);
CREATE INDEX idx_conversations_user_status  ON conversations (user_id, status);
CREATE INDEX idx_conversations_last_message ON conversations (user_id, last_message_at DESC);

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
--  TABLE: raw_notes
--  Stores user text before and after AI parsing
-- ============================================================

CREATE TABLE raw_notes (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID            NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  conversation_id UUID            REFERENCES conversations (id) ON DELETE SET NULL,
  content         TEXT            NOT NULL,
  parsed_result   JSONB,
  status          raw_note_status NOT NULL DEFAULT 'pending',
  confidence      FLOAT           CHECK (confidence >= 0 AND confidence <= 1),
  error_message   TEXT,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_raw_notes_user_id         ON raw_notes (user_id);
CREATE INDEX idx_raw_notes_status          ON raw_notes (user_id, status);
CREATE INDEX idx_raw_notes_conversation_id ON raw_notes (conversation_id);

CREATE TRIGGER trg_raw_notes_updated_at
  BEFORE UPDATE ON raw_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
--  TABLE: transactions
-- ============================================================

CREATE TABLE transactions (
  id               UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID               NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  raw_note_id      UUID               REFERENCES raw_notes (id) ON DELETE SET NULL,
  amount           NUMERIC(18, 2)     NOT NULL CHECK (amount > 0),
  currency         CHAR(3)            NOT NULL,
  category         VARCHAR(80)        NOT NULL,
  item             VARCHAR(255),
  quantity         NUMERIC(18, 3),
  type             transaction_type   NOT NULL,
  source           transaction_source NOT NULL DEFAULT 'manual',
  raw_text         TEXT,
  confidence       FLOAT              CHECK (confidence >= 0 AND confidence <= 1),
  notes            TEXT,
  transaction_date TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id      ON transactions (user_id);
CREATE INDEX idx_transactions_user_date    ON transactions (user_id, transaction_date DESC);
CREATE INDEX idx_transactions_user_type    ON transactions (user_id, type);
CREATE INDEX idx_transactions_user_cat     ON transactions (user_id, category);
CREATE INDEX idx_transactions_raw_note_id  ON transactions (raw_note_id);

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
--  TABLE: messages
-- ============================================================

CREATE TABLE messages (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID           NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id         UUID           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role            message_role   NOT NULL,
  content         TEXT           NOT NULL,
  status          message_status NOT NULL DEFAULT 'completed',
  metadata        JSONB,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages (conversation_id, created_at ASC);
CREATE INDEX idx_messages_user_id         ON messages (user_id);


-- ============================================================
--  TABLE: global_memories
--  Long-term per-user memory facts for the AI
-- ============================================================

CREATE TABLE global_memories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key        VARCHAR(120) NOT NULL,
  value      JSONB       NOT NULL,
  type       VARCHAR(80) NOT NULL DEFAULT 'fact',
  confidence FLOAT       NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  source     VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_global_memories_user_key UNIQUE (user_id, key)
);

CREATE INDEX idx_global_memories_user_id ON global_memories (user_id);

CREATE TRIGGER trg_global_memories_updated_at
  BEFORE UPDATE ON global_memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
--  TABLE: conversation_memories
--  Short-term per-conversation memory facts for the AI
-- ============================================================

CREATE TABLE conversation_memories (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key             VARCHAR(120) NOT NULL,
  value           JSONB       NOT NULL,
  type            VARCHAR(80) NOT NULL DEFAULT 'fact',
  confidence      FLOAT       NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_conversation_memories_conv_key UNIQUE (conversation_id, key)
);

CREATE INDEX idx_conversation_memories_conv_id ON conversation_memories (conversation_id);
CREATE INDEX idx_conversation_memories_user_id ON conversation_memories (user_id);

CREATE TRIGGER trg_conversation_memories_updated_at
  BEFORE UPDATE ON conversation_memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

