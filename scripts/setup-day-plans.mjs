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

if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const sql = fs.readFileSync(path.join(root, 'supabase', 'migrations', '003_add_day_plans.sql'), 'utf8');

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('Connecting to database...');
  await client.connect();
  console.log('Running 003_add_day_plans.sql migration...');
  await client.query(sql);
  console.log('✅ day_plans table set up successfully!');
} catch (err) {
  console.error('❌ Error executing SQL:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
