-- Add early notification ID to reminders for 10-min-before feature
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS notification_early_id TEXT;

-- Copy Vault: saved clipboard snippets
CREATE TABLE IF NOT EXISTS copy_vault (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  label TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Personal'
);

ALTER TABLE copy_vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copy_vault_allow_all" ON copy_vault FOR ALL USING (true) WITH CHECK (true);

-- Contacts: personal contact backup
CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT,
  category TEXT NOT NULL DEFAULT 'Friend',
  notes TEXT
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_allow_all" ON contacts FOR ALL USING (true) WITH CHECK (true);
