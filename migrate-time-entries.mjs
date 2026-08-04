// Migration: add time_entries table for labor tracking
// Run with: DATABASE_URL=postgres://... node migrate-time-entries.mjs

import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  console.log("Creating time_entries table...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      description TEXT NOT NULL DEFAULT '',
      hours REAL NOT NULL DEFAULT 0,
      crew_member TEXT DEFAULT '',
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("time_entries table created.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
