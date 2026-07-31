// Server-only database module. Uses dynamic imports so Vite doesn't bundle for client.
// On Vercel (Node.js runtime without Bun), uses a no-op DB to avoid native module issues.
// On Bun (local dev), uses bun:sqlite.

let _db: any = null;
let _initialized = false;

const isVercel = !!process.env.VERCEL;

function createNoopDb() {
  const noop = () => {};
  const emptyArr: any[] = [];
  return {
    exec: noop,
    run: noop,
    prepare: () => ({ all: () => emptyArr, get: () => null, run: noop }),
    query: () => ({ all: () => emptyArr, get: () => null, run: noop }),
  };
}

export async function getDb() {
  if (_db && _initialized) return _db;
  
  if (isVercel) {
    _db = createNoopDb();
    _initialized = true;
    return _db;
  }

  let Database: any;
  try {
    const mod = await import("bun:sqlite");
    Database = mod.Database;
  } catch {
    // Fallback: no-op DB when bun:sqlite is unavailable
    _db = createNoopDb();
    _initialized = true;
    return _db;
  }
  const { existsSync, mkdirSync } = await import("fs");
  const dir = (typeof import.meta.dir !== 'undefined' ? import.meta.dir : '/tmp') + '/../../data';
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
      subscription_tier TEXT NOT NULL DEFAULT 'trial',
      trial_ends_at TEXT,
      stripe_customer_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    -- Add subscription columns if upgrading existing DB
    INSERT OR IGNORE INTO users (id) VALUES ('__schema_check__');
    UPDATE users SET subscription_tier = 'trial' WHERE subscription_tier IS NULL;
    DELETE FROM users WHERE id = '__schema_check__';
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
      signature_data TEXT DEFAULT '',
      actual_material_cost REAL NOT NULL DEFAULT 0,
      actual_labor_cost REAL NOT NULL DEFAULT 0,
      actual_other_cost REAL NOT NULL DEFAULT 0,
      start_date TEXT DEFAULT '',
      end_date TEXT DEFAULT '',
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
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      rating INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
    CREATE TABLE IF NOT EXISTS proposal_views (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      ip_address TEXT DEFAULT '',
      user_agent TEXT DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_pv_estimate ON proposal_views(estimate_id);
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      unit TEXT NOT NULL DEFAULT 'each',
      unit_cost REAL NOT NULL DEFAULT 0,
      trade TEXT DEFAULT '',
      supplier TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_materials_user ON materials(user_id);
    CREATE INDEX IF NOT EXISTS idx_materials_trade ON materials(trade);
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invoice_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      due_date TEXT DEFAULT '',
      paid_at TEXT,
      total REAL NOT NULL DEFAULT 0,
      pdf_data TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_inv_estimate ON invoices(estimate_id);
    CREATE INDEX IF NOT EXISTS idx_inv_user ON invoices(user_id);
    CREATE TABLE IF NOT EXISTS email_automations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      template TEXT DEFAULT '',
      last_triggered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ea_user_type ON email_automations(user_id, type);
    CREATE TABLE IF NOT EXISTS automation_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      estimate_id TEXT,
      recipient TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_al_user ON automation_logs(user_id);
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh_key TEXT NOT NULL,
      auth_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ps_user ON push_subscriptions(user_id);
    CREATE TABLE IF NOT EXISTS price_lists (
      supplier TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (supplier, user_id)
    );
    CREATE TABLE IF NOT EXISTS builder_integrations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT DEFAULT '',
      realm_id TEXT DEFAULT '',
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_bi_user_platform ON builder_integrations(user_id, platform);
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      project_name TEXT NOT NULL,
      trade TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      frequency TEXT NOT NULL DEFAULT 'quarterly',
      scope_of_work TEXT DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT DEFAULT '',
      next_visit_date TEXT DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      estimate_id TEXT REFERENCES estimates(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_contracts_user ON contracts(user_id);
    CREATE INDEX IF NOT EXISTS idx_contracts_next_visit ON contracts(next_visit_date);
    CREATE TABLE IF NOT EXISTS contract_visits (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      scheduled_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      work_order_id TEXT,
      notes TEXT DEFAULT '',
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cv_contract ON contract_visits(contract_id);
    CREATE INDEX IF NOT EXISTS idx_cv_scheduled ON contract_visits(scheduled_date);
    CREATE TABLE IF NOT EXISTS actual_costs (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      line_item_id TEXT REFERENCES line_items(id) ON DELETE SET NULL,
      actual_material_cost REAL NOT NULL DEFAULT 0,
      actual_labor_hours REAL NOT NULL DEFAULT 0,
      actual_labor_cost REAL NOT NULL DEFAULT 0,
      actual_other_cost REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ac_estimate ON actual_costs(estimate_id);
    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'estimator',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tm_owner ON team_members(owner_id);
    CREATE INDEX IF NOT EXISTS idx_tm_user ON team_members(user_id);
    CREATE TABLE IF NOT EXISTS team_invites (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'estimator',
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ti_token ON team_invites(token);
    CREATE TABLE IF NOT EXISTS qbo_tokens (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      realm_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      rating INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
    CREATE TABLE IF NOT EXISTS proposal_views (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      ip_address TEXT DEFAULT '',
      user_agent TEXT DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_pv_estimate ON proposal_views(estimate_id);
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      unit TEXT NOT NULL DEFAULT 'each',
      unit_cost REAL NOT NULL DEFAULT 0,
      trade TEXT DEFAULT '',
      supplier TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_materials_user ON materials(user_id);
    CREATE INDEX IF NOT EXISTS idx_materials_trade ON materials(trade);
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invoice_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      due_date TEXT DEFAULT '',
      paid_at TEXT,
      total REAL NOT NULL DEFAULT 0,
      pdf_data TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_inv_estimate ON invoices(estimate_id);
    CREATE INDEX IF NOT EXISTS idx_inv_user ON invoices(user_id);
    CREATE TABLE IF NOT EXISTS email_automations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      template TEXT DEFAULT '',
      last_triggered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ea_user_type ON email_automations(user_id, type);
    CREATE TABLE IF NOT EXISTS automation_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      estimate_id TEXT,
      recipient TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_al_user ON automation_logs(user_id);
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh_key TEXT NOT NULL,
      auth_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ps_user ON push_subscriptions(user_id);
    CREATE TABLE IF NOT EXISTS price_lists (
      supplier TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (supplier, user_id)
    );
    CREATE TABLE IF NOT EXISTS builder_integrations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT DEFAULT '',
      realm_id TEXT DEFAULT '',
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_bi_user_platform ON builder_integrations(user_id, platform);
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      project_name TEXT NOT NULL,
      trade TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      frequency TEXT NOT NULL DEFAULT 'quarterly',
      scope_of_work TEXT DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT DEFAULT '',
      next_visit_date TEXT DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      estimate_id TEXT REFERENCES estimates(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_contracts_user ON contracts(user_id);
    CREATE INDEX IF NOT EXISTS idx_contracts_next_visit ON contracts(next_visit_date);
    CREATE TABLE IF NOT EXISTS contract_visits (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      scheduled_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      work_order_id TEXT,
      notes TEXT DEFAULT '',
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cv_contract ON contract_visits(contract_id);
    CREATE INDEX IF NOT EXISTS idx_cv_scheduled ON contract_visits(scheduled_date);
    CREATE TABLE IF NOT EXISTS actual_costs (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      line_item_id TEXT REFERENCES line_items(id) ON DELETE SET NULL,
      actual_material_cost REAL NOT NULL DEFAULT 0,
      actual_labor_hours REAL NOT NULL DEFAULT 0,
      actual_labor_cost REAL NOT NULL DEFAULT 0,
      actual_other_cost REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ac_estimate ON actual_costs(estimate_id);
    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'estimator',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tm_owner ON team_members(owner_id);
    CREATE INDEX IF NOT EXISTS idx_tm_user ON team_members(user_id);
    CREATE TABLE IF NOT EXISTS team_invites (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'estimator',
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ti_token ON team_invites(token);
    CREATE TABLE IF NOT EXISTS qbo_tokens (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      realm_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tli_template ON template_line_items(template_id);
    CREATE TABLE IF NOT EXISTS reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON reset_tokens(token);
    CREATE TABLE IF NOT EXISTS line_item_photos (
      id TEXT PRIMARY KEY,
      line_item_id TEXT NOT NULL REFERENCES line_items(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      photo_data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_lip_line_item ON line_item_photos(line_item_id);
    CREATE TABLE IF NOT EXISTS change_orders (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS change_order_items (
      id TEXT PRIMARY KEY,
      change_order_id TEXT NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'each',
      unit_cost REAL NOT NULL DEFAULT 0,
      markup_percent REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      rating INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
    CREATE TABLE IF NOT EXISTS proposal_views (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      ip_address TEXT DEFAULT '',
      user_agent TEXT DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_pv_estimate ON proposal_views(estimate_id);
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      unit TEXT NOT NULL DEFAULT 'each',
      unit_cost REAL NOT NULL DEFAULT 0,
      trade TEXT DEFAULT '',
      supplier TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_materials_user ON materials(user_id);
    CREATE INDEX IF NOT EXISTS idx_materials_trade ON materials(trade);
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invoice_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      due_date TEXT DEFAULT '',
      paid_at TEXT,
      total REAL NOT NULL DEFAULT 0,
      pdf_data TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_inv_estimate ON invoices(estimate_id);
    CREATE INDEX IF NOT EXISTS idx_inv_user ON invoices(user_id);
    CREATE TABLE IF NOT EXISTS email_automations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      template TEXT DEFAULT '',
      last_triggered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ea_user_type ON email_automations(user_id, type);
    CREATE TABLE IF NOT EXISTS automation_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      estimate_id TEXT,
      recipient TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_al_user ON automation_logs(user_id);
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh_key TEXT NOT NULL,
      auth_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ps_user ON push_subscriptions(user_id);
    CREATE TABLE IF NOT EXISTS price_lists (
      supplier TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (supplier, user_id)
    );
    CREATE TABLE IF NOT EXISTS builder_integrations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT DEFAULT '',
      realm_id TEXT DEFAULT '',
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_bi_user_platform ON builder_integrations(user_id, platform);
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      project_name TEXT NOT NULL,
      trade TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      frequency TEXT NOT NULL DEFAULT 'quarterly',
      scope_of_work TEXT DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT DEFAULT '',
      next_visit_date TEXT DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      estimate_id TEXT REFERENCES estimates(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_contracts_user ON contracts(user_id);
    CREATE INDEX IF NOT EXISTS idx_contracts_next_visit ON contracts(next_visit_date);
    CREATE TABLE IF NOT EXISTS contract_visits (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      scheduled_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      work_order_id TEXT,
      notes TEXT DEFAULT '',
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cv_contract ON contract_visits(contract_id);
    CREATE INDEX IF NOT EXISTS idx_cv_scheduled ON contract_visits(scheduled_date);
    CREATE TABLE IF NOT EXISTS actual_costs (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      line_item_id TEXT REFERENCES line_items(id) ON DELETE SET NULL,
      actual_material_cost REAL NOT NULL DEFAULT 0,
      actual_labor_hours REAL NOT NULL DEFAULT 0,
      actual_labor_cost REAL NOT NULL DEFAULT 0,
      actual_other_cost REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ac_estimate ON actual_costs(estimate_id);
    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'estimator',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tm_owner ON team_members(owner_id);
    CREATE INDEX IF NOT EXISTS idx_tm_user ON team_members(user_id);
    CREATE TABLE IF NOT EXISTS team_invites (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'estimator',
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ti_token ON team_invites(token);
    CREATE TABLE IF NOT EXISTS qbo_tokens (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      realm_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_co_estimate ON change_orders(estimate_id);
    CREATE INDEX IF NOT EXISTS idx_coi_co ON change_order_items(change_order_id);
  `);
  // Migrate: add subscription columns if they don't exist
  try { db.run("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT DEFAULT NULL"); } catch {}
  try { db.run("ALTER TABLE proposals ADD COLUMN pdf_data TEXT DEFAULT NULL"); } catch {}
  try { db.run("ALTER TABLE proposals ADD COLUMN sent_to_email TEXT DEFAULT NULL"); } catch {}
  try { db.run("ALTER TABLE proposals ADD COLUMN sent_at TEXT DEFAULT NULL"); } catch {}
  try { db.run("ALTER TABLE line_items ADD COLUMN material_id TEXT DEFAULT NULL"); } catch {}
  try { db.run("ALTER TABLE invoices ADD COLUMN payment_link_id TEXT DEFAULT NULL"); } catch {}
  try { db.run("ALTER TABLE estimates ADD COLUMN contract_id TEXT DEFAULT NULL"); } catch {}
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
