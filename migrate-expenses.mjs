// Migration: add expenses table for job costing
// Run with: DATABASE_URL=postgres://... node migrate-expenses.mjs

import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  console.log("Creating expenses table...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      description TEXT NOT NULL DEFAULT '',
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT 'materials',
      vendor TEXT DEFAULT '',
      expense_date DATE DEFAULT CURRENT_DATE,
      receipt_url TEXT,
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Add index for fast lookup by estimate
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_expenses_estimate_id ON expenses(estimate_id);
  `);

  console.log("expenses table created.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
