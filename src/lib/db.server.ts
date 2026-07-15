// Server-only database module. Uses dynamic imports so Vite doesn't bundle for client.

let _db: any = null;
let _initialized = false;

export async function getDb() {
  if (_db && _initialized) return _db;
  const { Database } = await import("bun:sqlite");
  const { existsSync, mkdirSync } = await import("fs");
  const dir = `${import.meta.dir}/../../data`;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const db = new Database(`${dir}/app.db`);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS estimates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_name TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      trade TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_estimates_user ON estimates(user_id);
    CREATE TABLE IF NOT EXISTS line_items (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'each',
      unit_cost REAL NOT NULL DEFAULT 0,
      markup_percent REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_line_items_estimate ON line_items(estimate_id);
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      proposal_number TEXT NOT NULL,
      terms TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_proposals_estimate ON proposals(estimate_id);
    CREATE INDEX IF NOT EXISTS idx_proposals_user ON proposals(user_id);
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      trade_type TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_templates_trade ON templates(trade_type);
    CREATE TABLE IF NOT EXISTS template_line_items (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'each',
      unit_cost REAL NOT NULL DEFAULT 0,
      markup_percent REAL NOT NULL DEFAULT 10,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_tli_template ON template_line_items(template_id);
  `);
  // Migrate: add subscription columns if they don't exist
  try { db.run("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT DEFAULT NULL"); } catch {}
  try { db.run("ALTER TABLE proposals ADD COLUMN pdf_data TEXT DEFAULT NULL"); } catch {}
  db.run("DELETE FROM sessions WHERE expires_at < datetime('now')");
  _db = db;
  _initialized = true;
  return db;
}

// User operations
export interface UserRow { id: string; email: string; name: string; }

export function createUser(email: string, password: string, name: string): UserRow {
  const db = getDbSync();
  const id = crypto.randomUUID();
  const hash = Bun.password.hashSync(password, { algorithm: "bcrypt", cost: 10 });
  db.run("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)", [id, email, name, hash]);
  return { id, email, name };
}

export function verifyUser(email: string, password: string): UserRow | null {
  const db = getDbSync();
  const row = db.query("SELECT id, email, name, password_hash FROM users WHERE email = ?").get(email) as any;
  if (!row || !Bun.password.verifySync(password, row.password_hash)) return null;
  return { id: row.id, email: row.email, name: row.name };
}

// Estimate operations
export interface EstimateRow {
  id: string; user_id: string; project_name: string; customer_name: string;
  trade: string; status: string; notes: string; created_at: string; updated_at: string;
}

export interface LineItemRow {
  id: string; estimate_id: string; description: string; quantity: number;
  unit: string; unit_cost: number; markup_percent: number; sort_order: number;
}

export function createEstimate(userId: string, projectName: string, customerName: string, trade: string): string {
  const db = getDbSync();
  const id = crypto.randomUUID();
  db.run("INSERT INTO estimates (id, user_id, project_name, customer_name, trade) VALUES (?, ?, ?, ?, ?)",
    [id, userId, projectName, customerName, trade]);
  return id;
}

export function getEstimatesByUser(userId: string): Array<EstimateRow & { total: number }> {
  const db = getDbSync();
  return db.query(`
    SELECT e.*, COALESCE((
      SELECT SUM((li.quantity * li.unit_cost) * (1 + li.markup_percent / 100.0))
      FROM line_items li WHERE li.estimate_id = e.id
    ), 0) as total
    FROM estimates e WHERE e.user_id = ? ORDER BY e.updated_at DESC
  `).all(userId) as any;
}

export function getEstimateById(id: string): (EstimateRow & { total: number }) | null {
  const db = getDbSync();
  const row = db.query(`
    SELECT e.*, COALESCE((
      SELECT SUM((li.quantity * li.unit_cost) * (1 + li.markup_percent / 100.0))
      FROM line_items li WHERE li.estimate_id = e.id
    ), 0) as total
    FROM estimates e WHERE e.id = ?
  `).get(id) as any;
  return row || null;
}

export function getLineItems(estimateId: string): LineItemRow[] {
  const db = getDbSync();
  return db.query("SELECT * FROM line_items WHERE estimate_id = ? ORDER BY sort_order").all(estimateId) as any;
}

export function addLineItem(estimateId: string, item: { description: string; quantity: number; unit: string; unit_cost: number; markup_percent: number }): string {
  const db = getDbSync();
  const id = crypto.randomUUID();
  const maxOrder = db.query("SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM line_items WHERE estimate_id = ?").get(estimateId) as any;
  db.run("INSERT INTO line_items (id, estimate_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, estimateId, item.description, item.quantity, item.unit, item.unit_cost, item.markup_percent, maxOrder.next]);
  db.run("UPDATE estimates SET updated_at = datetime('now') WHERE id = ?", [estimateId]);
  return id;
}

export function updateLineItem(id: string, item: { description?: string; quantity?: number; unit?: string; unit_cost?: number; markup_percent?: number }): void {
  const db = getDbSync();
  const fields: string[] = [];
  const vals: any[] = [];
  if (item.description !== undefined) { fields.push("description = ?"); vals.push(item.description); }
  if (item.quantity !== undefined) { fields.push("quantity = ?"); vals.push(item.quantity); }
  if (item.unit !== undefined) { fields.push("unit = ?"); vals.push(item.unit); }
  if (item.unit_cost !== undefined) { fields.push("unit_cost = ?"); vals.push(item.unit_cost); }
  if (item.markup_percent !== undefined) { fields.push("markup_percent = ?"); vals.push(item.markup_percent); }
  if (fields.length === 0) return;
  vals.push(id);
  db.run(`UPDATE line_items SET ${fields.join(", ")} WHERE id = ?`, vals);
  db.run("UPDATE estimates SET updated_at = datetime('now') WHERE id = (SELECT estimate_id FROM line_items WHERE id = ?)", [id]);
}

export function deleteLineItem(id: string): void {
  const db = getDbSync();
  db.run("DELETE FROM line_items WHERE id = ?", [id]);
}

export function updateEstimate(id: string, data: { project_name?: string; customer_name?: string; trade?: string; status?: string; notes?: string }): void {
  const db = getDbSync();
  const fields: string[] = [];
  const vals: any[] = [];
  if (data.project_name !== undefined) { fields.push("project_name = ?"); vals.push(data.project_name); }
  if (data.customer_name !== undefined) { fields.push("customer_name = ?"); vals.push(data.customer_name); }
  if (data.trade !== undefined) { fields.push("trade = ?"); vals.push(data.trade); }
  if (data.status !== undefined) { fields.push("status = ?"); vals.push(data.status); }
  if (data.notes !== undefined) { fields.push("notes = ?"); vals.push(data.notes); }
  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");
  vals.push(id);
  db.run(`UPDATE estimates SET ${fields.join(", ")} WHERE id = ?`, vals);
}

export function deleteEstimate(id: string): void {
  const db = getDbSync();
  db.run("DELETE FROM estimates WHERE id = ?", [id]);
}

// Sync helper for use within server functions
function getDbSync() {
  if (!_db) throw new Error("Database not initialized. Call getDb() first.");
  return _db;
}
