-- ============================================================
-- AHM Supabase Database Setup
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- expenses (Finance tab)
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  name        TEXT        NOT NULL,
  amount      NUMERIC     NOT NULL,
  date        DATE        NOT NULL
);

-- calendar_todos (Calendar tab)
CREATE TABLE IF NOT EXISTS calendar_todos (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  name            TEXT        NOT NULL,
  due_date        DATE        NOT NULL,
  completed       BOOLEAN     DEFAULT FALSE,
  notification_id TEXT
);

-- tomorrow_prep (Daily tab)
CREATE TABLE IF NOT EXISTS tomorrow_prep (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  item1      TEXT,
  item2      TEXT,
  item3      TEXT,
  date       DATE        NOT NULL
);

-- birthdays (Daily tab)
CREATE TABLE IF NOT EXISTS birthdays (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name       TEXT        NOT NULL,
  day        INTEGER     NOT NULL CHECK (day BETWEEN 1 AND 31),
  month      INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
  note       TEXT
);

-- meeting_notes (Projects tab)
CREATE TABLE IF NOT EXISTS meeting_notes (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  client_name  TEXT        NOT NULL,
  date         DATE        NOT NULL,
  discussion   TEXT        NOT NULL,
  action_items JSONB       DEFAULT '[]'::jsonb
);

-- reminders (Reminders tab)
CREATE TABLE IF NOT EXISTS reminders (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  description     TEXT        NOT NULL,
  remind_at       TIMESTAMPTZ NOT NULL,
  fired           BOOLEAN     DEFAULT FALSE,
  notification_id TEXT
);

-- ============================================================
-- Disable RLS for personal use (no auth needed)
-- ============================================================
ALTER TABLE expenses         DISABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_todos   DISABLE ROW LEVEL SECURITY;
ALTER TABLE tomorrow_prep    DISABLE ROW LEVEL SECURITY;
ALTER TABLE birthdays        DISABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_notes    DISABLE ROW LEVEL SECURITY;
ALTER TABLE reminders        DISABLE ROW LEVEL SECURITY;
