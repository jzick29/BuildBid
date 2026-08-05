// Migration: customer portal tables + estimates.client_user_id
// Run with: DATABASE_URL=postgres://... node migrate-portal.mjs
import pkg from "pg";
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS client_users (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, email TEXT NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', company_name TEXT DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (user_id, email))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS client_sessions (id TEXT PRIMARY KEY, client_user_id TEXT NOT NULL REFERENCES client_users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await pool.query("ALTER TABLE estimates ADD COLUMN IF NOT EXISTS client_user_id TEXT REFERENCES client_users(id) ON DELETE SET NULL");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_cu_user ON client_users(user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_cs_client ON client_sessions(client_user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_estimates_client ON estimates(client_user_id)");
  console.log("Portal migration complete.");
  await pool.end();
}
migrate().catch((err) => { console.error("Migration failed:", err); process.exit(1); });
