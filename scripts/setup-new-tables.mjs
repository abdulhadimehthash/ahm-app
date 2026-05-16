import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function readEnvFile() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const env = { ...readEnvFile(), ...process.env };
const connectionString = env.DATABASE_URL;

const sql = `
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

-- Disable RLS on all new tables
ALTER TABLE expenses         DISABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_todos   DISABLE ROW LEVEL SECURITY;
ALTER TABLE tomorrow_prep    DISABLE ROW LEVEL SECURITY;
ALTER TABLE birthdays        DISABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_notes    DISABLE ROW LEVEL SECURITY;
ALTER TABLE reminders        DISABLE ROW LEVEL SECURITY;
`;

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('Connecting to Supabase...');
  await client.connect();
  console.log('Running migrations...');
  await client.query(sql);
  console.log('✅ All 6 new tables created successfully:');
  console.log('   - expenses');
  console.log('   - calendar_todos');
  console.log('   - tomorrow_prep');
  console.log('   - birthdays');
  console.log('   - meeting_notes');
  console.log('   - reminders');
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
