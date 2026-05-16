import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function readEnvFile() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
      .map(l => l.trim()).filter(l => l && !l.startsWith('#') && l.includes('='))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
  );
}

const env = { ...readEnvFile(), ...process.env };
const client = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const sql = `
CREATE TABLE IF NOT EXISTS proposals (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  type           TEXT        NOT NULL CHECK (type IN ('client', 'connection')),
  name           TEXT        NOT NULL,
  description    TEXT        NOT NULL,
  generated_text TEXT        NOT NULL,
  image_url      TEXT
);
ALTER TABLE proposals DISABLE ROW LEVEL SECURITY;
`;

try {
  await client.connect();
  await client.query(sql);
  console.log('✅ proposals table created');
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
} finally {
  await client.end();
}
