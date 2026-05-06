import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const skipOnMissingEnv = process.argv.includes('--skip-on-missing-env');

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
  if (skipOnMissingEnv) {
    console.log('Skipping database setup: DATABASE_URL is not configured.');
    process.exit(0);
  }
  console.error('DATABASE_URL is required. Copy .env.example to .env, then run npm run setup:db.');
  process.exit(1);
}

const migrationPath = path.join(root, 'supabase', 'migrations', '001_initial_schema.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  await client.query(sql);
  console.log('Supabase schema is ready.');
} finally {
  await client.end();
}
