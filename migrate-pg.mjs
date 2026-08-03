import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log('Creating core tables...');

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      subscription_tier TEXT NOT NULL DEFAULT 'trial',
      trial_ends_at TEXT,
      stripe_customer_id TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      frozen INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`;

  await sql`
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
      contract_id TEXT DEFAULT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_estimates_user ON estimates(user_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS line_items (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'each',
      unit_cost REAL NOT NULL DEFAULT 0,
      markup_percent REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      material_id TEXT DEFAULT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_line_items_estimate ON line_items(estimate_id)`;

  // Remaining tables
  const tables = [
    `CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, message TEXT NOT NULL, rating INTEGER DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS proposal_views (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ip_address TEXT DEFAULT '', user_agent TEXT DEFAULT '')`,
    `CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT DEFAULT '', unit TEXT NOT NULL DEFAULT 'each', unit_cost REAL NOT NULL DEFAULT 0, trade TEXT DEFAULT '', supplier TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, invoice_number INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'draft', due_date TEXT DEFAULT '', paid_at TEXT, total REAL NOT NULL DEFAULT 0, pdf_data TEXT DEFAULT '', payment_link_id TEXT DEFAULT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS email_automations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, template TEXT DEFAULT '', last_triggered_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS automation_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, estimate_id TEXT, recipient TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, endpoint TEXT NOT NULL UNIQUE, p256dh_key TEXT NOT NULL, auth_key TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS price_lists (supplier TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_count INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (supplier, user_id))`,
    `CREATE TABLE IF NOT EXISTS builder_integrations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, platform TEXT NOT NULL, access_token TEXT NOT NULL, refresh_token TEXT DEFAULT '', realm_id TEXT DEFAULT '', expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, customer_name TEXT NOT NULL, project_name TEXT NOT NULL, trade TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', frequency TEXT NOT NULL DEFAULT 'quarterly', scope_of_work TEXT DEFAULT '', start_date TEXT NOT NULL, end_date TEXT DEFAULT '', next_visit_date TEXT DEFAULT '', amount REAL NOT NULL DEFAULT 0, estimate_id TEXT REFERENCES estimates(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS contract_visits (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE, scheduled_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled', work_order_id TEXT, notes TEXT DEFAULT '', completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS actual_costs (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, line_item_id TEXT REFERENCES line_items(id) ON DELETE SET NULL, actual_material_cost REAL NOT NULL DEFAULT 0, actual_labor_hours REAL NOT NULL DEFAULT 0, actual_labor_cost REAL NOT NULL DEFAULT 0, actual_other_cost REAL NOT NULL DEFAULT 0, notes TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS team_members (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL DEFAULT 'estimator', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS team_invites (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, email TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'estimator', token TEXT UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS qbo_tokens (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, access_token TEXT NOT NULL, refresh_token TEXT NOT NULL, realm_id TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, trade_type TEXT NOT NULL, description TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS template_line_items (id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit TEXT NOT NULL DEFAULT 'each', unit_cost REAL NOT NULL DEFAULT 0, markup_percent REAL NOT NULL DEFAULT 10, sort_order INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, proposal_number TEXT NOT NULL, terms TEXT DEFAULT '', pdf_data TEXT DEFAULT NULL, sent_to_email TEXT DEFAULT NULL, sent_at TIMESTAMPTZ DEFAULT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS reset_tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS line_item_photos (id TEXT PRIMARY KEY, line_item_id TEXT NOT NULL REFERENCES line_items(id) ON DELETE CASCADE, filename TEXT NOT NULL, photo_data TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS change_orders (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, description TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS change_order_items (id TEXT PRIMARY KEY, change_order_id TEXT NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit TEXT NOT NULL DEFAULT 'each', unit_cost REAL NOT NULL DEFAULT 0, markup_percent REAL NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0)`,
  ];

  for (const t of tables) {
    await sql.unsafe(t);
  }

  // Indexes
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_pv_estimate ON proposal_views(estimate_id)`,
    `CREATE INDEX IF NOT EXISTS idx_materials_user ON materials(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_materials_trade ON materials(trade)`,
    `CREATE INDEX IF NOT EXISTS idx_inv_estimate ON invoices(estimate_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inv_user ON invoices(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ea_user_type ON email_automations(user_id, type)`,
    `CREATE INDEX IF NOT EXISTS idx_al_user ON automation_logs(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ps_user ON push_subscriptions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bi_user_platform ON builder_integrations(user_id, platform)`,
    `CREATE INDEX IF NOT EXISTS idx_contracts_user ON contracts(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_contracts_next_visit ON contracts(next_visit_date)`,
    `CREATE INDEX IF NOT EXISTS idx_cv_contract ON contract_visits(contract_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cv_scheduled ON contract_visits(scheduled_date)`,
    `CREATE INDEX IF NOT EXISTS idx_ac_estimate ON actual_costs(estimate_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tm_owner ON team_members(owner_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tm_user ON team_members(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ti_token ON team_invites(token)`,
    `CREATE INDEX IF NOT EXISTS idx_templates_trade ON templates(trade_type)`,
    `CREATE INDEX IF NOT EXISTS idx_tli_template ON template_line_items(template_id)`,
    `CREATE INDEX IF NOT EXISTS idx_proposals_estimate ON proposals(estimate_id)`,
    `CREATE INDEX IF NOT EXISTS idx_proposals_user ON proposals(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON reset_tokens(token)`,
    `CREATE INDEX IF NOT EXISTS idx_lip_line_item ON line_item_photos(line_item_id)`,
    `CREATE INDEX IF NOT EXISTS idx_co_estimate ON change_orders(estimate_id)`,
    `CREATE INDEX IF NOT EXISTS idx_coi_co ON change_order_items(change_order_id)`,
  ];

  for (const idx of indexes) {
    await sql.unsafe(idx);
  }

  console.log('All tables and indexes created successfully.');
}

migrate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
