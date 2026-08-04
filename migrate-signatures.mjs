// Migration: add signatures table for digital signature capture
// Run with: DATABASE_URL=postgres://... node migrate-signatures.mjs

import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  console.log("Creating signatures table...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS signatures (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      signature_data TEXT NOT NULL,
      signed_by_name TEXT,
      signed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("signatures table created.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
