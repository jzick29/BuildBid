import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log('Running additions migration...');

  // 1. Add tax_rate to estimates
  await sql`ALTER TABLE estimates ADD COLUMN IF NOT EXISTS tax_rate REAL NOT NULL DEFAULT 0`;
  console.log('✓ Added tax_rate to estimates');

  // 2. Add user_id to templates (nullable — seeded templates have NULL, custom templates have user_id)
  await sql`ALTER TABLE templates ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE`;
  console.log('✓ Added user_id to templates');

  // 3. Add item_count to templates for display
  await sql`ALTER TABLE templates ADD COLUMN IF NOT EXISTS item_count INTEGER NOT NULL DEFAULT 0`;
  console.log('✓ Added item_count to templates');

  // 4. Create estimate_versions table
  await sql`
    CREATE TABLE IF NOT EXISTS estimate_versions (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('✓ Created estimate_versions table');

  await sql`CREATE INDEX IF NOT EXISTS idx_ev_estimate ON estimate_versions(estimate_id)`;
  console.log('✓ Created idx_ev_estimate index');

  // 5. Create template_shares table for sharing
  await sql`
    CREATE TABLE IF NOT EXISTS template_shares (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      shared_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      share_token TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('✓ Created template_shares table');

  await sql`CREATE INDEX IF NOT EXISTS idx_ts_template ON template_shares(template_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ts_token ON template_shares(share_token)`;

  console.log('All additions migrated successfully.');
}

migrate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
