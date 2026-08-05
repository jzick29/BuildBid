// Vercel Build Output API - BuildBid
// Static SSR import + inline auth & /api/call handlers
import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import handler from "./dist/server/server.js";
import { parseEstimateFromDescription, estimateFromDescription } from "./src/lib/ai-prompts";

const getPool = () => {
  if (!(globalThis as any).__buildbid_pool) {
    try {
      (globalThis as any).__buildbid_pool = new Pool({
        connectionString: process.env.DATABASE_URL!,
        ssl: { rejectUnauthorized: false },
        max: 1,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
      });
    } catch (e: any) {
      console.error("[getPool] Pool creation failed:", e.message);
      throw e;
    }
  }
  return (globalThis as any).__buildbid_pool;
};
function parseCookies(req: IncomingMessage): Record<string, string> {
  const c: Record<string, string> = {};
  const h = req.headers.cookie;
  if (h) h.split(";").forEach(x => { const [k, ...v] = x.trim().split("="); if (k) c[k] = v.join("="); });
  return c;
}
function readBody(req: IncomingMessage): Promise<any> {
  return new Promise(r => { let d = ""; req.on("data", (ch: string) => d += ch); req.on("end", () => { try { r(JSON.parse(d)); } catch { r({}); } }); });
}
function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise(r => { let d = ""; req.on("data", (ch: string) => d += ch); req.on("end", () => r(d)); });
}

async function handleSignup(body: any) {
  const { email, password, name, source } = body || {};
  if (!email || !password) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { "Content-Type": "application/json" } });
  const pool = getPool();
  const exist = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
  if (exist.rows[0]) return new Response(JSON.stringify({ error: "Email in use" }), { status: 409, headers: { "Content-Type": "application/json" } });
  const id = crypto.randomUUID();
  const hash = bcrypt.hashSync(password, 10);
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  // First user is admin
  const users = await pool.query("SELECT COUNT(*) as c FROM users");
  const role = parseInt(users.rows[0]?.c || "0") === 0 ? "admin" : "user";
  await pool.query("INSERT INTO users (id, email, password_hash, name, subscription_tier, trial_ends_at, role, source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [id, email, hash, name || "", "trial", trialEndsAt, role, source || ""]);
  const token = crypto.randomUUID();
  await pool.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1,$2,$3)", [token, id, new Date(Date.now() + 7 * 86400000).toISOString()]);
  const resp = new Response(JSON.stringify({ success: true, user: { id, email, name } }), { status: 200, headers: { "Content-Type": "application/json" } });
  resp.headers.append("Set-Cookie", `buildbid_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 86400}`);
  return resp;
}
async function handleLogin(body: any) {
  const { email, password } = body || {};
  if (!email || !password) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { "Content-Type": "application/json" } });
  const pool = getPool();
  const r = await pool.query("SELECT id, email, name, password_hash, frozen FROM users WHERE email=$1", [email]);
  if (!r.rows[0]) return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: { "Content-Type": "application/json" } });
  if (!bcrypt.compareSync(password, r.rows[0].password_hash)) return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: { "Content-Type": "application/json" } });
  if (r.rows[0].frozen === 1) return new Response(JSON.stringify({ error: "Account frozen. Contact support." }), { status: 403, headers: { "Content-Type": "application/json" } });
  const token = crypto.randomUUID();
  await pool.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1,$2,$3)", [token, r.rows[0].id, new Date(Date.now() + 7 * 86400000).toISOString()]);
  const resp = new Response(JSON.stringify({ success: true, user: r.rows[0] }), { status: 200, headers: { "Content-Type": "application/json" } });
  resp.headers.append("Set-Cookie", `buildbid_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 86400}`);
  return resp;
}
async function handleMe(req: IncomingMessage) {
  const token = parseCookies(req)["buildbid_session"];
  if (!token) return new Response(JSON.stringify({ user: null }), { status: 200, headers: { "Content-Type": "application/json" } });
  const pool = getPool();
  const r = await pool.query("SELECT u.id, u.email, u.name, u.frozen FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.expires_at>NOW()", [token]);
  if (!r.rows[0]) return new Response(JSON.stringify({ user: null }), { status: 200, headers: { "Content-Type": "application/json" } });
  if (r.rows[0].frozen === 1) return new Response(JSON.stringify({ user: null, error: "Account frozen. Contact support." }), { status: 403, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ user: r.rows[0] }), { status: 200, headers: { "Content-Type": "application/json" } });
}
async function handleLogout(req: IncomingMessage) {
  const token = parseCookies(req)["buildbid_session"];
  if (token) { const pool = getPool(); await pool.query("DELETE FROM sessions WHERE id=$1", [token]); }
  const resp = new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  resp.headers.append("Set-Cookie", "buildbid_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return resp;
}

const CLIENT_SESSION_COOKIE = "buildbid_client_session";
const CLIENT_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// Resolve the current portal (client) user from the client session cookie, or null.
async function getClientUser(req: IncomingMessage) {
  const token = parseCookies(req)[CLIENT_SESSION_COOKIE];
  if (!token) return null;
  const pool = getPool();
  const r = await pool.query(
    "SELECT cu.id, cu.user_id, cu.email, cu.name, cu.company_name, cu.active FROM client_sessions cs JOIN client_users cu ON cu.id = cs.client_user_id WHERE cs.id=$1 AND cs.expires_at > NOW()",
    [token]
  );
  if (!r.rows[0] || r.rows[0].active !== 1) return null;
  return r.rows[0];
}

async function handleClientLogin(body: any) {
  const { email, password } = body || {};
  if (!email || !password) return new Response(JSON.stringify({ error: "Email and password are required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  const pool = getPool();
  const r = await pool.query("SELECT id, user_id, email, name, company_name, password_hash, active FROM client_users WHERE LOWER(email)=LOWER($1)", [email]);
  const row = r.rows[0];
  if (!row || !bcrypt.compareSync(password, row.password_hash)) return new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401, headers: { "Content-Type": "application/json" } });
  if (row.active !== 1) return new Response(JSON.stringify({ error: "This portal account has been disabled. Contact your contractor." }), { status: 403, headers: { "Content-Type": "application/json" } });
  const token = crypto.randomUUID();
  await pool.query("INSERT INTO client_sessions (id, client_user_id, expires_at) VALUES ($1,$2,$3)", [token, row.id, new Date(Date.now() + CLIENT_SESSION_DURATION_MS).toISOString()]);
  const resp = new Response(JSON.stringify({ success: true, user: { id: row.id, email: row.email, name: row.name, company_name: row.company_name } }), { status: 200, headers: { "Content-Type": "application/json" } });
  resp.headers.append("Set-Cookie", `${CLIENT_SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 86400}`);
  return resp;
}

async function handleClientLogout(req: IncomingMessage) {
  const token = parseCookies(req)[CLIENT_SESSION_COOKIE];
  if (token) { const pool = getPool(); await pool.query("DELETE FROM client_sessions WHERE id=$1", [token]); }
  const resp = new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  resp.headers.append("Set-Cookie", `${CLIENT_SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  return resp;
}

async function handleClientMe(req: IncomingMessage) {
  const client = await getClientUser(req);
  if (!client) return new Response(JSON.stringify({ user: null }), { status: 200, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ user: { id: client.id, email: client.email, name: client.name, company_name: client.company_name } }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function toWebRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? "localhost";
  const proto = (req.headers["x-forwarded-proto"] as string) ?? "https";
  const url = `${proto}://${host}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) for (const x of v) headers.append(k, x);
    else if (v != null) headers.set(k, v);
  }
  return new Request(url, { method: req.method ?? "GET", headers });
}

export default async function vercelHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = req.url ?? "/";
    // Auth
    if (req.method === "POST" && url === "/api/signup") { const wr = await handleSignup(await readBody(req)); res.statusCode = wr.status; wr.headers.forEach((v: string, k: string) => res.setHeader(k, v)); res.end(await wr.text()); return; }
    if (req.method === "POST" && url === "/api/login") { const wr = await handleLogin(await readBody(req)); res.statusCode = wr.status; wr.headers.forEach((v: string, k: string) => res.setHeader(k, v)); res.end(await wr.text()); return; }
    if (req.method === "GET" && url === "/api/me") { const wr = await handleMe(req); res.statusCode = wr.status; wr.headers.forEach((v: string, k: string) => res.setHeader(k, v)); res.end(await wr.text()); return; }
    if (req.method === "POST" && url === "/api/logout") { const wr = await handleLogout(req); res.statusCode = wr.status; wr.headers.forEach((v: string, k: string) => res.setHeader(k, v)); res.end(await wr.text()); return; }
    if (req.method === "POST" && url === "/api/seed-admin") {
      const pool = getPool();
      // Ensure schema exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL DEFAULT '',
          password_hash TEXT NOT NULL, subscription_tier TEXT NOT NULL DEFAULT 'trial',
          trial_ends_at TIMESTAMPTZ, stripe_customer_id TEXT, role TEXT NOT NULL DEFAULT 'user',
          source TEXT DEFAULT '',
          frozen INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS reset_tokens (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL
        );
      `);
      // Migrations: add columns that may not exist in existing databases
      try { await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS source TEXT DEFAULT ''"); } catch {}
      try { await pool.query("ALTER TABLE estimates ADD COLUMN IF NOT EXISTS tax_rate REAL NOT NULL DEFAULT 0"); } catch {}
      try { await pool.query("ALTER TABLE line_items ADD COLUMN IF NOT EXISTS tax_rate REAL NOT NULL DEFAULT 0"); } catch {}
      // Fix existing TEXT columns to TIMESTAMPTZ (legacy migration)
      const alterCol = async (table: string, col: string) => {
        try { await pool.query(`ALTER TABLE ${table} ALTER COLUMN ${col} TYPE TIMESTAMPTZ USING ${col}::timestamptz`); } catch {}
      };
      await alterCol("users", "created_at");
      await alterCol("users", "trial_ends_at");
      await alterCol("sessions", "created_at");
      await alterCol("sessions", "expires_at");
      await alterCol("reset_tokens", "expires_at");

      // Application tables
      const appTables = [
        `CREATE TABLE IF NOT EXISTS estimates (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, project_name TEXT NOT NULL, customer_name TEXT NOT NULL, trade TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', notes TEXT DEFAULT '', signature_data TEXT DEFAULT '', tax_rate REAL NOT NULL DEFAULT 0, actual_material_cost REAL NOT NULL DEFAULT 0, actual_labor_cost REAL NOT NULL DEFAULT 0, actual_other_cost REAL NOT NULL DEFAULT 0, start_date TEXT DEFAULT '', end_date TEXT DEFAULT '', contract_id TEXT DEFAULT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS line_items (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit TEXT NOT NULL DEFAULT 'each', unit_cost REAL NOT NULL DEFAULT 0, markup_percent REAL NOT NULL DEFAULT 0, tax_rate REAL NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, material_id TEXT DEFAULT NULL)`,
        `CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, message TEXT NOT NULL, rating INTEGER DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS proposal_views (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ip_address TEXT DEFAULT '', user_agent TEXT DEFAULT '')`,
        `CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT DEFAULT '', unit TEXT NOT NULL DEFAULT 'each', unit_cost REAL NOT NULL DEFAULT 0, trade TEXT DEFAULT '', category TEXT DEFAULT '', supplier TEXT DEFAULT '', supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL, inventory_qty REAL NOT NULL DEFAULT 0, reorder_point REAL NOT NULL DEFAULT 0, restock_qty REAL NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, contact_name TEXT DEFAULT '', email TEXT DEFAULT '', phone TEXT DEFAULT '', website TEXT DEFAULT '', notes TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS material_price_history (id TEXT PRIMARY KEY, material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE, old_cost REAL NOT NULL DEFAULT 0, new_cost REAL NOT NULL DEFAULT 0, changed_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, invoice_number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', due_date TEXT DEFAULT '', paid_at TEXT, subtotal REAL NOT NULL DEFAULT 0, tax_rate REAL NOT NULL DEFAULT 0, tax_amount REAL NOT NULL DEFAULT 0, discount_type TEXT DEFAULT '', discount_value REAL NOT NULL DEFAULT 0, discount_amount REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0, notes TEXT DEFAULT '', pdf_data TEXT DEFAULT '', payment_link_id TEXT DEFAULT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS invoice_items (id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit TEXT NOT NULL DEFAULT 'each', unit_cost REAL NOT NULL DEFAULT 0, markup_percent REAL NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0)`,
        `CREATE TABLE IF NOT EXISTS recurring_invoices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, estimate_id TEXT REFERENCES estimates(id) ON DELETE SET NULL, name TEXT NOT NULL, frequency TEXT NOT NULL DEFAULT 'monthly', next_date TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', template_data TEXT DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS invoice_reminders (id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, sent_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, sent_to TEXT NOT NULL, sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), status TEXT NOT NULL DEFAULT 'sent')`,
        `CREATE TABLE IF NOT EXISTS email_automations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, template TEXT DEFAULT '', last_triggered_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS automation_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, estimate_id TEXT, recipient TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, endpoint TEXT NOT NULL UNIQUE, p256dh_key TEXT NOT NULL, auth_key TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS price_lists (supplier TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_count INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (supplier, user_id))`,
        `CREATE TABLE IF NOT EXISTS builder_integrations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, platform TEXT NOT NULL, access_token TEXT NOT NULL, refresh_token TEXT DEFAULT '', realm_id TEXT DEFAULT '', expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, email TEXT DEFAULT '', phone TEXT DEFAULT '', address TEXT DEFAULT '', notes TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, customer_name TEXT NOT NULL, customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL, project_name TEXT NOT NULL, trade TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', frequency TEXT NOT NULL DEFAULT 'quarterly', scope_of_work TEXT DEFAULT '', start_date TEXT NOT NULL, end_date TEXT DEFAULT '', next_visit_date TEXT DEFAULT '', amount REAL NOT NULL DEFAULT 0, auto_renew BOOLEAN NOT NULL DEFAULT false, renewal_notice_days INTEGER NOT NULL DEFAULT 30, estimate_id TEXT REFERENCES estimates(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS contract_notes (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), note TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,,
        `CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, entity_type TEXT DEFAULT '', entity_id TEXT DEFAULT '', details TEXT DEFAULT '', ip_address TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS automation_rules (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, trigger_type TEXT NOT NULL, trigger_config TEXT DEFAULT '{}', action_type TEXT NOT NULL, action_config TEXT DEFAULT '{}', enabled BOOLEAN NOT NULL DEFAULT true, last_triggered_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        /* fix dup */ `CREATE TABLE IF NOT EXISTS contract_visits (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE, scheduled_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled', work_order_id TEXT, notes TEXT DEFAULT '', completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS actual_costs (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, line_item_id TEXT REFERENCES line_items(id) ON DELETE SET NULL, actual_material_cost REAL NOT NULL DEFAULT 0, actual_labor_hours REAL NOT NULL DEFAULT 0, actual_labor_cost REAL NOT NULL DEFAULT 0, actual_other_cost REAL NOT NULL DEFAULT 0, notes TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS team_members (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL DEFAULT 'estimator', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS team_invites (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, email TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'estimator', token TEXT UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS qbo_tokens (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, access_token TEXT NOT NULL, refresh_token TEXT NOT NULL, realm_id TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, trade_type TEXT NOT NULL, description TEXT DEFAULT '', user_id TEXT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS template_line_items (id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit TEXT NOT NULL DEFAULT 'each', unit_cost REAL NOT NULL DEFAULT 0, markup_percent REAL NOT NULL DEFAULT 10, sort_order INTEGER NOT NULL DEFAULT 0)`,
        `CREATE TABLE IF NOT EXISTS template_shares (id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE, shared_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT UNIQUE NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `ALTER TABLE contracts ADD COLUMN IF NOT EXISTS customer_id TEXT`,
        `ALTER TABLE contracts ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false`,
        `ALTER TABLE contracts ADD COLUMN IF NOT EXISTS renewal_notice_days INTEGER NOT NULL DEFAULT 30`,
        `ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ`,
        `ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`,
        `ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ`,
        `ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS approved_by TEXT`,
        `ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS rejected_by TEXT`,
        `ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS reject_reason TEXT DEFAULT ''`,
        `ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS total_cost REAL NOT NULL DEFAULT 0`,
        `ALTER TABLE materials ADD COLUMN IF NOT EXISTS category TEXT DEFAULT ''`,
        `ALTER TABLE materials ADD COLUMN IF NOT EXISTS supplier_id TEXT`,
        `ALTER TABLE materials ADD COLUMN IF NOT EXISTS inventory_qty REAL NOT NULL DEFAULT 0`,
        `ALTER TABLE materials ADD COLUMN IF NOT EXISTS reorder_point REAL NOT NULL DEFAULT 0`,
        `ALTER TABLE materials ADD COLUMN IF NOT EXISTS restock_qty REAL NOT NULL DEFAULT 0`,
        `ALTER TABLE materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
        `ALTER TABLE materials ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`,
        `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal REAL NOT NULL DEFAULT 0`,
        `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate REAL NOT NULL DEFAULT 0`,
        `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount REAL NOT NULL DEFAULT 0`,
        `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT ''`,
        `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_value REAL NOT NULL DEFAULT 0`,
        `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount REAL NOT NULL DEFAULT 0`,
        `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT ''`,
        `ALTER TABLE invoices ALTER COLUMN invoice_number TYPE TEXT`,
        `ALTER TABLE templates ADD COLUMN IF NOT EXISTS user_id TEXT`,
        `CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, proposal_number TEXT NOT NULL, terms TEXT DEFAULT '', pdf_data TEXT DEFAULT NULL, sent_to_email TEXT DEFAULT NULL, sent_at TIMESTAMPTZ DEFAULT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS line_item_photos (id TEXT PRIMARY KEY, line_item_id TEXT NOT NULL REFERENCES line_items(id) ON DELETE CASCADE, filename TEXT NOT NULL, photo_data TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS change_orders (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, description TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', submitted_at TIMESTAMPTZ, approved_at TIMESTAMPTZ, rejected_at TIMESTAMPTZ, approved_by TEXT REFERENCES users(id), rejected_by TEXT REFERENCES users(id), reject_reason TEXT DEFAULT '', total_cost REAL NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS change_order_items (id TEXT PRIMARY KEY, change_order_id TEXT NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit TEXT NOT NULL DEFAULT 'each', unit_cost REAL NOT NULL DEFAULT 0, markup_percent REAL NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0)`,
        `CREATE TABLE IF NOT EXISTS change_order_templates (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT DEFAULT '', trade TEXT DEFAULT '', items_json TEXT NOT NULL DEFAULT '[]', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS change_order_history (id TEXT PRIMARY KEY, change_order_id TEXT NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, old_status TEXT DEFAULT '', new_status TEXT NOT NULL, comment TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS markup_presets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, markup_percent REAL NOT NULL DEFAULT 40, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS labor_rates (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, rate_per_hour REAL NOT NULL DEFAULT 85, trade TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS estimate_versions (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, snapshot TEXT NOT NULL, version_number INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, trade TEXT DEFAULT '', source TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS time_entries (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), description TEXT DEFAULT '', hours REAL NOT NULL DEFAULT 0, crew_member TEXT DEFAULT '', date TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), description TEXT DEFAULT '', amount DECIMAL(12,2) NOT NULL DEFAULT 0, category TEXT NOT NULL DEFAULT 'materials', vendor TEXT DEFAULT '', expense_date TEXT NOT NULL DEFAULT '', receipt_url TEXT DEFAULT NULL, notes TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        // === payments (admin) ===
        `CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, stripe_event_id TEXT DEFAULT '', amount INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'usd', status TEXT NOT NULL DEFAULT 'succeeded', tier TEXT DEFAULT '', customer_email TEXT DEFAULT '', stripe_customer_id TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        // === customer portal ===
        `CREATE TABLE IF NOT EXISTS client_users (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, email TEXT NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', company_name TEXT DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (user_id, email))`,
        `CREATE TABLE IF NOT EXISTS client_sessions (id TEXT PRIMARY KEY, client_user_id TEXT NOT NULL REFERENCES client_users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS client_user_id TEXT REFERENCES client_users(id) ON DELETE SET NULL`,
        `CREATE INDEX IF NOT EXISTS idx_cu_user ON client_users(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_cs_client ON client_sessions(client_user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_estimates_client ON estimates(client_user_id)`,
        ];
        for (const t of appTables) {
        try { await pool.query(t); } catch (e) { console.error("App table create error:", e); }
      }

      await pool.query("ALTER TABLE estimates ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ");
      await pool.query("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email='admin@buildbid.pro')");
      await pool.query("DELETE FROM users WHERE email='admin@buildbid.pro'");
      const id = crypto.randomUUID();
      const hash = bcrypt.hashSync("BuildBid2026!", 10);
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      await pool.query("INSERT INTO users (id, email, password_hash, name, subscription_tier, trial_ends_at, role) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [id, "admin@buildbid.pro", hash, "Admin", "trial", trialEndsAt, "admin"]);
      res.statusCode = 200; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ success: true, email: "admin@buildbid.pro" }));
      return;
    }
    // Pricing redirect
    if (req.method === "GET" && url === "/pricing") { res.writeHead(302, { Location: "/#pricing" }); res.end(); return; }
    // Privacy page
    if (req.method === "GET" && url === "/privacy") { res.writeHead(200, { "Content-Type": "text/html" }); res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Privacy Policy — BuildBid</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/app-BJG-1l0U.css"></head><body class="bg-gray-50"><div class="max-w-2xl mx-auto px-6 py-16"><a href="/" class="text-indigo-600 font-bold">← Back to BuildBid</a><h1 class="text-3xl font-bold mt-6">Privacy Policy</h1><p class="mt-4 text-gray-600">Effective date: August 3, 2026</p><div class="mt-8 space-y-6 text-gray-700"><p>BuildBid ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how your personal information is collected, used, and disclosed by BuildBid.</p><h2 class="text-xl font-semibold mt-6">Information We Collect</h2><p>We collect information you provide directly to us, such as when you create an account: name, email address, and business information. We also collect usage data about how you interact with our platform.</p><h2 class="text-xl font-semibold mt-6">How We Use Information</h2><p>We use the information we collect to: provide and maintain our services; send you technical notices and support messages; respond to your comments and questions; and improve our platform.</p><h2 class="text-xl font-semibold mt-6">Data Sharing</h2><p>We do not sell your personal information. We may share information with third-party service providers who help us operate our platform (e.g., hosting, payment processing).</p><h2 class="text-xl font-semibold mt-6">Security</h2><p>We take reasonable measures to protect your personal information from loss, theft, misuse, and unauthorized access.</p><h2 class="text-xl font-semibold mt-6">Contact</h2><p>If you have questions about this Privacy Policy, please contact us at support@buildbid.pro.</p></div></div></body></html>`); return; }
    // Terms page
    if (req.method === "GET" && url === "/terms") { res.writeHead(200, { "Content-Type": "text/html" }); res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Terms of Service — BuildBid</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/app-BJG-1l0U.css"></head><body class="bg-gray-50"><div class="max-w-2xl mx-auto px-6 py-16"><a href="/" class="text-indigo-600 font-bold">← Back to BuildBid</a><h1 class="text-3xl font-bold mt-6">Terms of Service</h1><p class="mt-4 text-gray-600">Effective date: August 3, 2026</p><div class="mt-8 space-y-6 text-gray-700"><p>By accessing or using BuildBid ("the Service"), you agree to be bound by these Terms of Service.</p><h2 class="text-xl font-semibold mt-6">Account Terms</h2><p>You are responsible for maintaining the security of your account. You must provide accurate and complete information when creating an account. You may not use the Service for any illegal or unauthorized purpose.</p><h2 class="text-xl font-semibold mt-6">Subscription &amp; Billing</h2><p>BuildBid offers tiered subscription plans with monthly or annual billing. All fees are non-refundable except as required by law. We reserve the right to change pricing with 30 days' notice.</p><h2 class="text-xl font-semibold mt-6">Free Trial</h2><p>New users receive a 14-day free trial. No credit card is required to start the trial. At the end of the trial period, you must subscribe to a paid plan to continue using the Service.</p><h2 class="text-xl font-semibold mt-6">Limitation of Liability</h2><p>BuildBid is provided "as is" without warranty of any kind. We shall not be liable for any damages arising from the use of the Service.</p><h2 class="text-xl font-semibold mt-6">Contact</h2><p>Questions about these Terms? Contact us at support@buildbid.pro.</p></div></div></body></html>`); return; }
    // Stripe webhook (raw body — must be before /api/call)
    if (req.method === "POST" && url === "/api/stripe-webhook") {
      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!sig || !webhookSecret) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing signature or secret" })); return; }
      const rawBody = await readRawBody(req);
      // Verify Stripe signature: header format is t=TIMESTAMP,v1=SIGNATURE
      try {
        const parts = sig.split(",").reduce((acc: Record<string,string>, p) => { const [k,v] = p.split("="); acc[k] = v; return acc; }, {});
        const signedPayload = `${parts["t"]}.${rawBody}`;
        const expected = crypto.createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");
        if (expected !== parts["v1"]) { res.statusCode = 401; res.end(JSON.stringify({ error: "Invalid signature" })); return; }
        const event = JSON.parse(rawBody);
        const pool = getPool();
        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          const customerEmail = session.customer_details?.email || session.customer_email;
          const metaUserId = session.metadata?.userId;
          const metaPlan = session.metadata?.plan;
          // Map amount_total to tier: 4900=starter, 9900=pro, 19900=shop
          const amountToTier: Record<number, string> = { 4900: "starter", 9900: "pro", 19900: "shop" };
          let tier = metaPlan || amountToTier[session.amount_total] || "";
          if (!tier) { res.statusCode = 200; res.end(JSON.stringify({ received: true, note: "Unknown plan amount" })); return; }
          let paidUserId = metaUserId || "";
          if (!paidUserId && customerEmail) {
            const uq = await pool.query("SELECT id FROM users WHERE email=$1", [customerEmail]);
            if (uq.rows[0]) paidUserId = uq.rows[0].id;
          }
          if (paidUserId) {
            await pool.query("UPDATE users SET subscription_tier=$1, stripe_customer_id=$2 WHERE id=$3", [tier, session.customer || null, paidUserId]);
          } else if (customerEmail) {
            await pool.query("UPDATE users SET subscription_tier=$1, stripe_customer_id=$2 WHERE email=$3", [tier, session.customer || null, customerEmail]);
          }
          try {
            await pool.query("INSERT INTO payments (id, user_id, stripe_event_id, amount, currency, status, tier, customer_email, stripe_customer_id, created_at) VALUES ($1,$2,$3,$4,$5,'succeeded',$6,$7,$8,NOW())",
              [crypto.randomUUID(), paidUserId || null, event.id || "", session.amount_total || 0, session.currency || "usd", tier, customerEmail || "", session.customer || null]);
          } catch (pe: any) { console.error("[stripe-webhook] payments insert failed:", pe.message); }
        }
        if (event.type === "invoice.payment_failed") {
          const invoice = event.data.object;
          const cusId = invoice.customer || "";
          const amount = invoice.amount_due || invoice.amount_remaining || 0;
          let invUserId = "";
          if (cusId) { const uq = await pool.query("SELECT id FROM users WHERE stripe_customer_id=$1", [cusId]); if (uq.rows[0]) invUserId = uq.rows[0].id; }
          try {
            await pool.query("INSERT INTO payments (id, user_id, stripe_event_id, amount, currency, status, tier, customer_email, stripe_customer_id, created_at) VALUES ($1,$2,$3,$4,$5,'failed',$6,$7,$8,NOW())",
              [crypto.randomUUID(), invUserId || null, event.id || "", amount, invoice.currency || "usd", "", invoice.customer_email || "", cusId]);
          } catch (pe: any) { console.error("[stripe-webhook] payments insert failed:", pe.message); }
        }
        res.statusCode = 200; res.end(JSON.stringify({ received: true }));
      } catch (e: any) {
        console.error("[stripe-webhook] Error:", e.message);
        res.statusCode = 400; res.end(JSON.stringify({ error: "Webhook processing failed" }));
      }
      return;
    }
    // /api/ai/estimate — natural language → structured line items (auth required)
    if (req.method === "POST" && url === "/api/ai/estimate") {
      try {
        const aiBody = await readBody(req);
        const aiCookies = parseCookies(req);
        const aiToken = aiCookies["buildbid_session"];
        if (!aiToken) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
        const aiPool = getPool();
        const aiAuth = await aiPool.query("SELECT u.id, u.frozen FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.expires_at>NOW()", [aiToken]);
        if (!aiAuth.rows[0]) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
        if (aiAuth.rows[0].frozen === 1) { res.statusCode = 403; res.end(JSON.stringify({ error: "Account frozen. Contact support." })); return; }
        const aiUserId = aiAuth.rows[0].id;
        const aiDescription = String(aiBody?.description || "").trim();
        const aiTrade = String(aiBody?.trade || "general").toLowerCase();
        if (!aiDescription) { res.statusCode = 400; res.end(JSON.stringify({ error: "Describe the job" })); return; }
        if (!["electrical", "plumbing", "hvac", "roofing", "general"].includes(aiTrade)) { res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid trade" })); return; }
        // Pull the user's supplier catalog for realistic pricing when available
        let aiCatalog: any[] = [];
        try {
          const catR = await aiPool.query("SELECT name, unit, unit_cost, trade FROM materials WHERE user_id=$1 AND unit_cost > 0 ORDER BY name", [aiUserId]);
          aiCatalog = catR.rows;
        } catch { /* catalog optional */ }
        const aiPhotos = Array.isArray(aiBody?.photos) ? aiBody.photos.map((p: any) => String(p?.name || p)).filter(Boolean) : [];
        const aiResult = parseEstimateFromDescription(aiDescription, aiTrade, {
          location: aiBody?.location,
          squareFootage: aiBody?.squareFootage ? Number(aiBody.squareFootage) : undefined,
          rooms: aiBody?.rooms ? Number(aiBody.rooms) : undefined,
          catalog: aiCatalog,
          photoCount: aiPhotos.length,
        });
        res.statusCode = 200; res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ...aiResult, prompt: estimateFromDescription(aiDescription, aiTrade), photos: aiPhotos }));
      } catch (e: any) {
        console.error("[ai/estimate] Error:", e?.message || e);
        res.statusCode = 500; res.end(JSON.stringify({ error: "AI estimate failed" }));
      }
      return;
    }
    // /api/call
    if (req.method === "POST" && url === "/api/call") {
      const body = await readBody(req);
      const fnName = body?.["function"];
      const args = body?.args || {};
      const cookies = parseCookies(req);
      const token = cookies["buildbid_session"];
      const pool = getPool();
      let userId = "";
      let userFrozen = 0;
      if (token) { const r = await pool.query("SELECT u.id, u.frozen FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.expires_at>NOW()", [token]); if (r.rows[0]) { userId = r.rows[0].id; userFrozen = r.rows[0].frozen || 0; } }
      let clientUser: any = null;
      try { clientUser = await getClientUser(req); } catch (e: any) { console.error("[portal] client session check failed:", e?.message || e); }
      let result: any;
      if (userFrozen === 1) { res.statusCode = 403; res.end(JSON.stringify({ error: "Account frozen. Contact support." })); return; }
      try {
        switch (fnName) {
          case "templates.listTemplates": case "templates.getTemplates": { const td = args?.data || {}; const trade = td.trade; const tab = td.tab || "all"; // all, my, shared
            let rows: any[];
            if (tab === "my" && userId) {
              rows = trade ? (await pool.query("SELECT * FROM templates WHERE user_id=$1 AND trade_type=$2 ORDER BY name", [userId, trade])).rows : (await pool.query("SELECT * FROM templates WHERE user_id=$1 ORDER BY name", [userId])).rows;
            } else if (tab === "shared" && userId) {
              rows = (await pool.query("SELECT t.*, ts.shared_by FROM templates t JOIN template_shares ts ON ts.template_id=t.id WHERE t.user_id IS DISTINCT FROM $1 ORDER BY t.name", [userId])).rows;
            } else {
              rows = trade ? (await pool.query("SELECT * FROM templates WHERE (user_id IS NULL OR user_id=$1) AND trade_type=$2 ORDER BY name", [userId, trade])).rows : (await pool.query("SELECT * FROM templates WHERE user_id IS NULL OR user_id=$1 ORDER BY trade_type, name", [userId])).rows;
            }
            result = { templates: rows }; break; }
          case "templates.getTemplate": { const tpl = (await pool.query("SELECT * FROM templates WHERE id=$1", [args?.data?.id])).rows[0]; if (!tpl) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; } const items = (await pool.query("SELECT * FROM template_line_items WHERE template_id=$1 ORDER BY sort_order", [args?.data?.id])).rows; result = { template: tpl, items }; break; }
          case "templates.createEstimateFromTemplate": { if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; } const d = args?.data || {}; if (!d.templateId || !d.projectName?.trim() || !d.customerName?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing fields" })); return; } const tpl = (await pool.query("SELECT * FROM templates WHERE id=$1", [d.templateId])).rows[0]; if (!tpl) { res.statusCode = 404; res.end(JSON.stringify({ error: "Template not found" })); return; } const items = (await pool.query("SELECT * FROM template_line_items WHERE template_id=$1 ORDER BY sort_order", [d.templateId])).rows; const eid = crypto.randomUUID(); await pool.query("INSERT INTO estimates (id, user_id, project_name, customer_name, trade) VALUES ($1,$2,$3,$4,$5)", [eid, userId, d.projectName.trim(), d.customerName.trim(), tpl.trade_type]); for (const it of items) { await pool.query("INSERT INTO line_items (id, estimate_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,(SELECT COALESCE(MAX(sort_order),0)+1 FROM line_items WHERE estimate_id=$2))", [crypto.randomUUID(), eid, it.description, it.quantity, it.unit, it.unit_cost, it.markup_percent]); } result = { id: eid }; break; }
          case "templates.seedTemplates": { if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; } const adminCheck = await pool.query("SELECT role FROM users WHERE id=$1", [userId]); if (adminCheck.rows[0]?.role !== "admin") { res.statusCode = 403; res.end(JSON.stringify({ error: "Admin required" })); return; } const newTemplates = args?.data?.templates; if (!newTemplates || !Array.isArray(newTemplates)) { res.statusCode = 400; res.end(JSON.stringify({ error: "Provide templates array" })); return; } let seeded = 0; for (const t of newTemplates) { const exist = await pool.query("SELECT id FROM templates WHERE name=$1 LIMIT 1", [t.name]); if (exist.rows.length > 0) continue; const tid = crypto.randomUUID(); await pool.query("INSERT INTO templates (id, name, trade_type, description) VALUES ($1,$2,$3,$4)", [tid, t.name, t.trade_type, t.description]); for (let i = 0; i < t.items.length; i++) { const it = t.items[i]; await pool.query("INSERT INTO template_line_items (id, template_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [crypto.randomUUID(), tid, it.description, it.quantity, it.unit, it.unit_cost, it.markup_percent, i]); } seeded++; } result = { seeded, total: newTemplates.length }; break; }
          // === custom templates ===
          case "templates.saveCustomTemplate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const tc = args?.data || {};
            if (!tc.name?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing name" })); return; }
            let trade = tc.trade_type || "general";
            let items: any[] = [];
            if (tc.estimateId) {
              const est = (await pool.query("SELECT * FROM estimates WHERE id=$1 AND user_id=$2", [tc.estimateId, userId])).rows[0];
              if (!est) { res.statusCode = 404; res.end(JSON.stringify({ error: "Estimate not found" })); return; }
              trade = est.trade;
              items = (await pool.query("SELECT * FROM line_items WHERE estimate_id=$1 ORDER BY sort_order", [tc.estimateId])).rows;
            } else if (tc.items && Array.isArray(tc.items)) {
              items = tc.items;
            }
            const tid = crypto.randomUUID();
            await pool.query("INSERT INTO templates (id, name, trade_type, description, user_id) VALUES ($1,$2,$3,$4,$5)", [tid, tc.name.trim(), trade, tc.description || "", userId]);
            for (let i = 0; i < items.length; i++) {
              const it = items[i];
              await pool.query("INSERT INTO template_line_items (id, template_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [crypto.randomUUID(), tid, it.description, it.quantity, it.unit, it.unit_cost, it.markup_percent, i]);
            }
            result = { id: tid };
            break;
          }
          case "templates.updateTemplate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const tu = args?.data || {};
            if (!tu.id) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing id" })); return; }
            const trow = (await pool.query("SELECT user_id FROM templates WHERE id=$1", [tu.id])).rows[0];
            if (!trow || trow.user_id !== userId) { res.statusCode = 403; res.end(JSON.stringify({ error: "Not your template" })); return; }
            const fields: string[] = []; const vals: any[] = [];
            if (tu.name !== undefined) { fields.push("name=$" + (vals.length+1)); vals.push(tu.name.trim()); }
            if (tu.description !== undefined) { fields.push("description=$" + (vals.length+1)); vals.push(tu.description); }
            if (tu.trade_type !== undefined) { fields.push("trade_type=$" + (vals.length+1)); vals.push(tu.trade_type); }
            if (fields.length > 0) { vals.push(tu.id); await pool.query("UPDATE templates SET "+fields.join(", ")+" WHERE id=$"+(vals.length), vals); }
            result = { success: true };
            break;
          }
          case "templates.deleteTemplate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const td2 = args?.data || {};
            if (!td2.id) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing id" })); return; }
            const trow2 = (await pool.query("SELECT user_id FROM templates WHERE id=$1", [td2.id])).rows[0];
            if (!trow2 || trow2.user_id !== userId) { res.statusCode = 403; res.end(JSON.stringify({ error: "Not your template" })); return; }
            await pool.query("DELETE FROM template_line_items WHERE template_id=$1", [td2.id]);
            await pool.query("DELETE FROM templates WHERE id=$1", [td2.id]);
            result = { success: true };
            break;
          }
          case "templates.updateTemplateItem": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const tui = args?.data || {};
            if (!tui.id) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing id" })); return; }
            const tplCheck = (await pool.query("SELECT t.user_id FROM template_line_items ti JOIN templates t ON t.id=ti.template_id WHERE ti.id=$1", [tui.id])).rows[0];
            if (!tplCheck || tplCheck.user_id !== userId) { res.statusCode = 403; res.end(JSON.stringify({ error: "Not your template" })); return; }
            const ifields: string[] = []; const ivals: any[] = [];
            if (tui.description !== undefined) { ifields.push("description=$"+(ivals.length+1)); ivals.push(tui.description); }
            if (tui.quantity !== undefined) { ifields.push("quantity=$"+(ivals.length+1)); ivals.push(parseFloat(tui.quantity)); }
            if (tui.unit !== undefined) { ifields.push("unit=$"+(ivals.length+1)); ivals.push(tui.unit); }
            if (tui.unitCost !== undefined) { ifields.push("unit_cost=$"+(ivals.length+1)); ivals.push(parseFloat(tui.unitCost)); }
            if (tui.markupPercent !== undefined) { ifields.push("markup_percent=$"+(ivals.length+1)); ivals.push(parseFloat(tui.markupPercent)); }
            if (ifields.length > 0) { ivals.push(tui.id); await pool.query("UPDATE template_line_items SET "+ifields.join(", ")+" WHERE id=$"+(ivals.length), ivals); }
            result = { success: true };
            break;
          }
          case "templates.addTemplateItem": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const tai = args?.data || {};
            if (!tai.templateId) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing templateId" })); return; }
            const trow3 = (await pool.query("SELECT user_id FROM templates WHERE id=$1", [tai.templateId])).rows[0];
            if (!trow3 || trow3.user_id !== userId) { res.statusCode = 403; res.end(JSON.stringify({ error: "Not your template" })); return; }
            const nextSort = (await pool.query("SELECT COALESCE(MAX(sort_order), -1)+1 as n FROM template_line_items WHERE template_id=$1", [tai.templateId])).rows[0].n;
            await pool.query("INSERT INTO template_line_items (id, template_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [crypto.randomUUID(), tai.templateId, tai.description || "", tai.quantity || 1, tai.unit || "each", tai.unitCost || 0, tai.markupPercent || 0, nextSort]);
            result = { success: true };
            break;
          }
          case "templates.removeTemplateItem": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const tri = args?.data || {};
            if (!tri.id) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing id" })); return; }
            const tplCheck2 = (await pool.query("SELECT t.user_id FROM template_line_items ti JOIN templates t ON t.id=ti.template_id WHERE ti.id=$1", [tri.id])).rows[0];
            if (!tplCheck2 || tplCheck2.user_id !== userId) { res.statusCode = 403; res.end(JSON.stringify({ error: "Not your template" })); return; }
            await pool.query("DELETE FROM template_line_items WHERE id=$1", [tri.id]);
            result = { success: true };
            break;
          }
          // === template sharing ===
          case "templates.shareTemplate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const ts = args?.data || {};
            if (!ts.templateId) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing templateId" })); return; }
            const trow4 = (await pool.query("SELECT user_id FROM templates WHERE id=$1", [ts.templateId])).rows[0];
            if (!trow4 || trow4.user_id !== userId) { res.statusCode = 403; res.end(JSON.stringify({ error: "Not your template" })); return; }
            const tok = crypto.randomUUID();
            await pool.query("INSERT INTO template_shares (id, template_id, shared_by, token) VALUES ($1,$2,$3,$4)", [crypto.randomUUID(), ts.templateId, userId, tok]);
            const shareUrl = (process.env.SITE_URL || "https://buildbid.pro") + "/templates/shared/" + tok;
            result = { token: tok, url: shareUrl };
            break;
          }
          case "templates.listSharedTemplates": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const rows = (await pool.query("SELECT t.*, ts.shared_by, ts.token FROM templates t JOIN template_shares ts ON ts.template_id=t.id WHERE ts.shared_by=$1 ORDER BY t.name", [userId])).rows;
            result = { templates: rows };
            break;
          }
          case "templates.removeShare": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const trs = args?.data || {};
            if (!trs.id) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing id" })); return; }
            await pool.query("DELETE FROM template_shares WHERE id=$1 AND shared_by=$2", [trs.id, userId]);
            result = { success: true };
            break;
          }
          // === feedback & leads ===
          case "feedback.submit": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const { message, rating } = args?.data || {};
            if (!message?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Message required" })); return; }
            await pool.query("INSERT INTO feedback (id, user_id, message, rating) VALUES ($1,$2,$3,$4)", [crypto.randomUUID(), userId, message.trim(), rating || 0]);
            result = { success: true };
            break;
          }
          case "leads.submit": {
            const { name, email, trade, source } = args?.data || {};
            if (!name?.trim() || !email?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Name and email required" })); return; }
            await pool.query("INSERT INTO leads (id, name, email, trade, source) VALUES ($1,$2,$3,$4,$5)", [crypto.randomUUID(), name.trim(), email.trim(), trade || '', source || '']);
            result = { success: true };
            break;
          }
                    // === automation ===
          case "automation.listRules": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT * FROM automation_rules WHERE user_id = $1 ORDER BY created_at DESC", [userId])).rows;
            break;
          }
          case "automation.createRule": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const ar = args?.data || {};
            if (!ar.name?.trim() || !ar.trigger_type || !ar.action_type) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing fields" })); return; }
            await pool.query(
              "INSERT INTO automation_rules (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
              [crypto.randomUUID(), userId, ar.name.trim(), ar.trigger_type, JSON.stringify(ar.trigger_config || {}), ar.action_type, JSON.stringify(ar.action_config || {}), ar.enabled !== false]
            );
            result = { success: true };
            break;
          }
          case "automation.updateRule": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const au = args?.data || {};
            const fields: string[] = [];
            const vals: any[] = [];
            let px = 1;
            if (au.name !== undefined) { fields.push("name=$" + (px++)); vals.push(au.name); }
            if (au.trigger_config !== undefined) { fields.push("trigger_config=$" + (px++)); vals.push(JSON.stringify(au.trigger_config)); }
            if (au.action_config !== undefined) { fields.push("action_config=$" + (px++)); vals.push(JSON.stringify(au.action_config)); }
            if (au.enabled !== undefined) { fields.push("enabled=$" + (px++)); vals.push(au.enabled); }
            fields.push("updated_at = NOW()");
            vals.push(au.id, userId);
            await pool.query("UPDATE automation_rules SET " + fields.join(", ") + " WHERE id=$" + px + " AND user_id=$" + (px+1), vals);
            result = { success: true };
            break;
          }
          case "automation.toggleRule": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const at = args?.data || {};
            await pool.query("UPDATE automation_rules SET enabled = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3", [at.enabled, at.id, userId]);
            result = { success: true };
            break;
          }
          case "automation.deleteRule": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const ad = args?.data || {};
            await pool.query("DELETE FROM automation_rules WHERE id = $1 AND user_id = $2", [ad.id, userId]);
            result = { success: true };
            break;
          }
          
          case "analytics.getDashboardStats": case "analytics.getAnalytics": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const [stats, rev, trade, recent, pipeline] = await Promise.all([
              pool.query("SELECT COUNT(*) as total, SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) as won, SUM(CASE WHEN status='lost' THEN 1 ELSE 0 END) as lost, COALESCE(SUM(CASE WHEN status='won' THEN (SELECT COALESCE(SUM((li.quantity * li.unit_cost) * (1 + li.markup_percent / 100.0)), 0) FROM line_items li WHERE li.estimate_id = estimates.id) ELSE 0 END), 0) as total_revenue, COALESCE(AVG(CASE WHEN status='won' THEN (SELECT COALESCE(AVG(markup_percent), 0) FROM line_items li WHERE li.estimate_id = estimates.id) END), 0) as avg_markup FROM estimates WHERE user_id=$1", [userId]),
              pool.query("SELECT DATE_TRUNC('month', created_at) as month, SUM(total) as revenue FROM estimates WHERE status='won' AND user_id=$1 GROUP BY month ORDER BY month", [userId]),
              pool.query("SELECT trade, COUNT(*)::int as count, SUM(CASE WHEN status='won' THEN 1 ELSE 0 END)::int as won_count, ROUND(CASE WHEN COUNT(*) > 0 THEN 100.0 * SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) / COUNT(*) ELSE 0 END) as win_rate, COALESCE(ROUND(AVG(CASE WHEN status='won' THEN (SELECT COALESCE(AVG(markup_percent), 0) FROM line_items li WHERE li.estimate_id = estimates.id) END)), 0) as avg_markup, COALESCE(ROUND(AVG(grand_total)), 0) as avg_grand_total FROM estimates WHERE user_id=$1 GROUP BY trade ORDER BY count DESC", [userId]),
              pool.query("SELECT id, project_name, customer_name, trade, grand_total, created_at FROM estimates WHERE user_id=$1 AND status='won' ORDER BY created_at DESC LIMIT 5", [userId]),
              pool.query("SELECT COUNT(*)::int as pipeline_count, COALESCE(SUM(grand_total), 0) as pipeline_value FROM estimates WHERE user_id=$1 AND status IN ('sent','pending','draft')", [userId])
            ]);
            const s = stats.rows[0];
            const p = pipeline.rows[0];
            result = {
              totalEstimates: parseInt(s?.total || "0"), wonCount: parseInt(s?.won || "0"), lostCount: parseInt(s?.lost || "0"),
              winRate: parseInt(s?.total || "0") > 0 ? Math.round((parseInt(s?.won || "0") / (parseInt(s?.won || "0") + parseInt(s?.lost || "0") || 1)) * 100) : 0,
              avgMarkup: Math.round(parseFloat(s?.avg_markup || "0")),
              totalRevenue: parseFloat(s?.total_revenue || "0"),
              byTrade: trade.rows, byMonth: (await pool.query("SELECT DATE_TRUNC('month', created_at) as month, SUM(total) as revenue FROM estimates WHERE status='won' AND user_id=$1 GROUP BY month ORDER BY month", [userId])).rows,
              recentWins: recent.rows,
              pipelineCount: p?.pipeline_count || 0, pipelineValue: parseFloat(p?.pipeline_value || "0"),
            };
            break;
          }
          case "analytics.getRevenueTrend": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const rows = (await pool.query("SELECT DATE_TRUNC('month', created_at) as month, SUM(total) as revenue FROM estimates WHERE status='won' AND user_id=$1 GROUP BY month ORDER BY month", [userId])).rows;
            result = rows;
            break;
          }
          case "subscriptions.getSubscriptionStatus": { if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; } const ur = await pool.query("SELECT subscription_tier, trial_ends_at, stripe_customer_id FROM users WHERE id=$1", [userId]); const u = ur.rows[0]; result = { tier: u?.subscription_tier || "trial", trialEndsAt: u?.trial_ends_at, stripeCustomerId: u?.stripe_customer_id }; break; }
          case "auth.getCurrentUser": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const ur = await pool.query("SELECT id, email, name, subscription_tier, trial_ends_at, role FROM users WHERE id=$1", [userId]);
            const u = ur.rows[0];
            result = { user: u ? { ...u, subscriptionTier: u.subscription_tier, trialEndsAt: u.trial_ends_at, isAdmin: u.role === "admin" } : null };
            break;
          }
          case "estimates.listEstimates": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const rows = (await pool.query(
              "SELECT e.*, COALESCE((SELECT SUM((li.quantity * li.unit_cost) * (1 + li.markup_percent / 100.0)) FROM line_items li WHERE li.estimate_id = e.id), 0) as total FROM estimates e WHERE e.user_id = $1 ORDER BY e.updated_at DESC",
              [userId]
            )).rows;
            result = { estimates: rows };
            break;
          }
          case "estimates.createEstimate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d = args?.data || {};
            if (!d.projectName?.trim() || !d.customerName?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing fields" })); return; }
            const eid = crypto.randomUUID();
            await pool.query("INSERT INTO estimates (id, user_id, project_name, customer_name, trade, status) VALUES ($1,$2,$3,$4,$5,'draft')",
              [eid, userId, d.projectName.trim(), d.customerName.trim(), d.trade || "general"]);
            result = { id: eid };
            break;
          }
          case "estimates.deleteEstimate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const eid = args?.data?.id;
            if (!eid) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing id" })); return; }
            await pool.query("DELETE FROM line_items WHERE estimate_id=$1", [eid]);
            await pool.query("DELETE FROM estimates WHERE id=$1 AND user_id=$2", [eid, userId]);
            result = { success: true };
            break;
          }
          case "estimates.updateEstimateStatus": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d3 = args?.data || {};
            const ids = d3.ids;
            const status = d3.status;
            if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing ids or status" })); return; }
            const validStatuses = ["draft", "sent", "won", "lost"];
            if (!validStatuses.includes(status)) { res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid status" })); return; }
            const placeholders = ids.map((_:any,i:number) => "$" + (i+2)).join(",");
            const sql = "UPDATE estimates SET status=$1, updated_at=NOW() WHERE id IN (" + placeholders + ") AND user_id=$" + (ids.length+2);
            await pool.query(sql,
              [status, ...ids, userId]);
            result = { success: true, updated: ids.length };
            break;
          }
/* invoices.createInvoice moved to invoices section */
/* invoices.getInvoiceStats moved to invoices section */
          case "scheduling.getScheduledJobs": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            let sql2 = "SELECT id, project_name, customer_name, trade, status, start_date, end_date FROM estimates WHERE user_id = $1 AND start_date IS NOT NULL AND start_date != ''";
            const params2: any[] = [userId];
            if (args?.data?.month) { sql2 += " AND start_date LIKE $2"; params2.push(args.data.month + "%"); }
            sql2 += " ORDER BY start_date";
            result = (await pool.query(sql2, params2)).rows;
            break;
          }
          case "scheduling.getPipelineJobs": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query(
              "SELECT id, project_name, customer_name, trade, status, start_date, end_date FROM estimates WHERE user_id = $1 AND status IN ('won','scheduled','in-progress','completed') ORDER BY start_date",
              [userId]
            )).rows;
            break;
          }
          case "scheduling.getCalendar": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dcal = args?.data || {};
            const from = dcal.from || new Date().toISOString().slice(0,7) + "-01";
            const to = dcal.to || new Date(Date.now() + 7776000000).toISOString().slice(0,10);
            const ests = (await pool.query(
              "SELECT id, project_name, customer_name, trade, status, start_date, end_date FROM estimates WHERE user_id = $1 AND start_date BETWEEN $2 AND $3 ORDER BY start_date",
              [userId, from, to]
            )).rows;
            const visits = (await pool.query(
              "SELECT cv.id, cv.contract_id, cv.scheduled_date, cv.status, cv.notes, c.customer_name, c.project_name FROM contract_visits cv JOIN contracts c ON c.id = cv.contract_id WHERE c.user_id = $1 AND cv.scheduled_date BETWEEN $2 AND $3 ORDER BY cv.scheduled_date",
              [userId, from, to]
            )).rows;
            result = { jobs: ests, visits };
            break;
          }
          // === team ===
          case "team.getTeamMembers": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const memR = await pool.query("SELECT owner_id FROM team_members WHERE user_id = $1", [userId]);
            const ownerId = memR.rows[0]?.owner_id || userId;
            const members = (await pool.query("SELECT tm.*, u.email, u.name FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.owner_id = $1", [ownerId])).rows;
            const invites = (await pool.query("SELECT * FROM team_invites WHERE owner_id = $1 AND expires_at > NOW()", [ownerId])).rows;
            result = { members, invites, ownerId, isOwner: ownerId === userId };
            break;
          }
          case "team.inviteTeamMember": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d = args?.data || {};
            const ur = await pool.query("SELECT subscription_tier FROM users WHERE id = $1", [userId]);
            const tier = ur.rows[0]?.subscription_tier || "trial";
            const cntR = await pool.query("SELECT COUNT(*) as cnt FROM team_members WHERE owner_id = $1", [userId]);
            const maxMembers = tier === "shop" ? 999 : tier === "pro" ? 5 : 0;
            if (tier === "trial" || tier === "starter" || parseInt(cntR.rows[0].cnt) >= maxMembers) { res.statusCode = 400; res.end(JSON.stringify({ error: "Team features require Pro or Shop plan" })); return; }
            const token = crypto.randomUUID();
            await pool.query("INSERT INTO team_invites (id, owner_id, email, role, token, expires_at) VALUES ($1,$2,$3,$4,$5,$6)", [crypto.randomUUID(), userId, d.email, d.role || "member", token, new Date(Date.now() + 7*86400000).toISOString()]);
            result = { token, inviteUrl: "/api/accept-invite?token=" + token };
            break;
          }
          case "team.removeTeamMember": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d2 = args?.data || {};
            const mR = await pool.query("SELECT * FROM team_members WHERE id = $1", [d2.memberId]);
            if (!mR.rows[0]) { res.statusCode = 404; res.end(JSON.stringify({ error: "Member not found" })); return; }
            if (mR.rows[0].owner_id !== userId) { res.statusCode = 403; res.end(JSON.stringify({ error: "Not your team" })); return; }
            await pool.query("DELETE FROM team_members WHERE id = $1", [d2.memberId]);
            result = { success: true };
            break;
          }
          case "ai.createEstimate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const aiD = args?.data || {};
            if (!aiD.projectName?.trim() || !aiD.customerName?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Project and customer name required" })); return; }
            const aiItems = Array.isArray(aiD.lineItems) ? aiD.lineItems : [];
            if (aiItems.length === 0) { res.statusCode = 400; res.end(JSON.stringify({ error: "No line items to add" })); return; }
            const aiTrade = aiD.trade || "general";
            const aiEid = crypto.randomUUID();
            await pool.query("INSERT INTO estimates (id, user_id, project_name, customer_name, trade, status, notes) VALUES ($1,$2,$3,$4,$5,'draft',$6)",
              [aiEid, userId, String(aiD.projectName).trim(), String(aiD.customerName).trim(), aiTrade, aiD.notes ? String(aiD.notes).slice(0, 2000) : "Generated with AI-assisted estimating"]);
            let aiSort = 0;
            for (const it of aiItems) {
              const qty = Number(it.quantity) || 1;
              const cost = Number(it.unitCost) || Number(it.unit_cost) || 0;
              const mark = Number(it.markup);
              await pool.query("INSERT INTO line_items (id, estimate_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                [crypto.randomUUID(), aiEid, String(it.name || it.description || "").slice(0, 500), qty, it.unit || "each", cost, Number.isFinite(mark) ? mark : 0, aiSort++]);
            }
            const aiLaborHours = Number(aiD.laborHours) || 0;
            if (aiLaborHours > 0) {
              await pool.query("INSERT INTO line_items (id, estimate_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                [crypto.randomUUID(), aiEid, `Labor - ${aiTrade} (AI estimate)`, aiLaborHours, "hour", Number(aiD.laborRate) || 85, 0, aiSort++]);
            }
            result = { id: aiEid };
            break;
          }
          // === admin ===
          case "admin.listUsers": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const adminCheck = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
            if (adminCheck.rows[0]?.role !== "admin") { res.statusCode = 403; res.end(JSON.stringify({ error: "Admin required" })); return; }
            const rows = (await pool.query("SELECT u.id, u.email, u.name, u.subscription_tier, u.trial_ends_at, u.created_at, u.role, u.frozen, (SELECT COUNT(*) FROM estimates e WHERE e.user_id = u.id) as estimate_count FROM users u ORDER BY u.created_at DESC")).rows;
            result = { users: rows, stats: { total: rows.length, activeTrials: rows.filter((r:any)=>r.subscription_tier==="trial"&&r.frozen===0).length, paying: rows.filter((r:any)=>["starter","pro","shop"].includes(r.subscription_tier)).length, frozen: rows.filter((r:any)=>r.frozen===1).length } };
            break;
          }
          case "admin.setUserPlan": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const ac2 = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
            if (ac2.rows[0]?.role !== "admin") { res.statusCode = 403; res.end(JSON.stringify({ error: "Admin required" })); return; }
            const d3 = args?.data || {};
            if (!d3.userId || !["trial","free","starter","pro","shop"].includes(d3.tier)) { res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid" })); return; }
            await pool.query("UPDATE users SET subscription_tier = $1 WHERE id = $2", [d3.tier, d3.userId]);
            result = { success: true };
            break;
          }
          case "admin.toggleUserFrozen": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const ac3 = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
            if (ac3.rows[0]?.role !== "admin") { res.statusCode = 403; res.end(JSON.stringify({ error: "Admin required" })); return; }
            const d4 = args?.data || {};
            if (d4.userId === userId) { res.statusCode = 400; res.end(JSON.stringify({ error: "Cannot freeze yourself" })); return; }
            const uR = await pool.query("SELECT frozen FROM users WHERE id = $1", [d4.userId]);
            if (!uR.rows[0]) { res.statusCode = 404; res.end(JSON.stringify({ error: "User not found" })); return; }
            const newFrozen = uR.rows[0].frozen === 1 ? 0 : 1;
            await pool.query("UPDATE users SET frozen = $1 WHERE id = $2", [newFrozen, d4.userId]);
            await pool.query("DELETE FROM sessions WHERE user_id = $1", [d4.userId]);
            result = { success: true, frozen: newFrozen === 1 };
            break;
          }
          case "admin.deleteUser": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const ac4 = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
            if (ac4.rows[0]?.role !== "admin") { res.statusCode = 403; res.end(JSON.stringify({ error: "Admin required" })); return; }
            const d5 = args?.data || {};
            if (d5.userId === userId) { res.statusCode = 400; res.end(JSON.stringify({ error: "Cannot delete yourself" })); return; }
            await pool.query("DELETE FROM users WHERE id = $1", [d5.userId]);
            result = { success: true };
            break;
          }
          case "admin.setUserRole": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const ar3 = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
            if (ar3.rows[0]?.role !== "admin") { res.statusCode = 403; res.end(JSON.stringify({ error: "Admin required" })); return; }
            const dr = args?.data || {};
            await pool.query("UPDATE users SET role = $1 WHERE id = $2", [dr.role, dr.userId]);
            result = { success: true };
            break;
          }
          case "admin.getAuditLog": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const al = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
            if (al.rows[0]?.role !== "admin") { res.statusCode = 403; res.end(JSON.stringify({ error: "Admin required" })); return; }
            result = (await pool.query("SELECT a.*, COALESCE(u.email, 'system') as user_email FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 100")).rows;
            break;
          }
          case "admin.getPlatformStats": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const as4 = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
            if (as4.rows[0]?.role !== "admin") { res.statusCode = 403; res.end(JSON.stringify({ error: "Admin required" })); return; }
            const [uc, ec, rc, icc] = await Promise.all([
              pool.query("SELECT COUNT(*)::int as cnt FROM users"),
              pool.query("SELECT COUNT(*)::int as cnt, COALESCE(SUM(grand_total),0) as total_value FROM estimates"),
              pool.query("SELECT COUNT(*)::int as cnt FROM estimates WHERE status='won'"),
              pool.query("SELECT COUNT(*)::int as cnt FROM invoices"),
            ]);
            result = { totalUsers: uc.rows[0].cnt, totalEstimates: ec.rows[0].cnt, totalEstimateValue: parseFloat(ec.rows[0].total_value), totalWonJobs: rc.rows[0].cnt, totalInvoices: icc.rows[0].cnt };
            break;
          }
          case "admin.healthCheck": {
            const ok: any = { db: false, api: true, uptime: process.uptime() };
            try { await pool.query("SELECT 1"); ok.db = true; } catch {}
            result = ok;
            break;
          }
          case "admin.bulkEmail": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const abe = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
            if (abe.rows[0]?.role !== "admin") { res.statusCode = 403; res.end(JSON.stringify({ error: "Admin required" })); return; }
            const recipients = (await pool.query("SELECT email FROM users WHERE frozen = 0 AND subscription_tier != 'free'")).rows.map((r:any) => r.email);
            result = { recipients, ready: true };
            break;
          }
          case "admin.listPayments": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const apl = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
            if (apl.rows[0]?.role !== "admin") { res.statusCode = 403; res.end(JSON.stringify({ error: "Admin required" })); return; }
            const dp = args?.data || {};
            const statusFilter = dp.status && dp.status !== "all" ? String(dp.status) : null;
            const payRows = statusFilter
              ? (await pool.query("SELECT p.*, COALESCE(u.email, p.customer_email) AS user_email, u.name AS user_name FROM payments p LEFT JOIN users u ON u.id = p.user_id WHERE p.status = $1 ORDER BY p.created_at DESC LIMIT 500", [statusFilter])).rows
              : (await pool.query("SELECT p.*, COALESCE(u.email, p.customer_email) AS user_email, u.name AS user_name FROM payments p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 500")).rows;
            result = { payments: payRows, total: payRows.length };
            break;
          }
          case "admin.getPaymentStats": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const aps = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
            if (aps.rows[0]?.role !== "admin") { res.statusCode = 403; res.end(JSON.stringify({ error: "Admin required" })); return; }
            const [revQ, mrrQ, subQ, trialQ, totalQ, frozenQ, failedQ] = await Promise.all([
              pool.query("SELECT COALESCE(SUM(amount),0)::bigint as s FROM payments WHERE status = 'succeeded'"),
              pool.query("SELECT COALESCE(SUM(amount),0)::bigint as s FROM payments WHERE status = 'succeeded' AND created_at >= date_trunc('month', NOW())"),
              pool.query("SELECT COUNT(*)::int as c FROM users WHERE subscription_tier IN ('starter','pro','shop') AND frozen = 0"),
              pool.query("SELECT COUNT(*)::int as c FROM users WHERE subscription_tier = 'trial' AND frozen = 0"),
              pool.query("SELECT COUNT(*)::int as c FROM users"),
              pool.query("SELECT COUNT(*)::int as c FROM users WHERE frozen = 1"),
              pool.query("SELECT COUNT(*)::int as c FROM payments WHERE status = 'failed'"),
            ]);
            const totalRevenue = Number(revQ.rows[0].s) / 100;
            const mrr = Number(mrrQ.rows[0].s) / 100;
            const activeSubscribers = subQ.rows[0].c;
            const activeTrials = trialQ.rows[0].c;
            const totalUsers = totalQ.rows[0].c;
            const frozenUsers = frozenQ.rows[0].c;
            const failedPayments = failedQ.rows[0].c;
            const churned = (await pool.query("SELECT COUNT(*)::int as c FROM users WHERE stripe_customer_id IS NOT NULL AND stripe_customer_id != '' AND subscription_tier NOT IN ('starter','pro','shop') AND frozen = 0")).rows[0].c;
            const churnRate = (activeSubscribers + churned) > 0 ? Math.round((churned / (activeSubscribers + churned)) * 1000) / 10 : 0;
            result = { totalRevenue, mrr, activeSubscribers, activeTrials, totalUsers, frozenUsers, failedPayments, churned, churnRate, currency: "usd" };
            break;
          }
          // === push ===
          case "push.getVapidPublicKey": {
            result = { publicKey: process.env.VAPID_PUBLIC_KEY || "BHrL8vZC7MqK0vX4N9pW2yF3jR6tS1aD5cE8gH0kJ3mY7bU4wX9zA2nP6qV1lO5s" };
            break;
          }
          case "push.saveSubscription": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d6 = args?.data || {};
            const existS = await pool.query("SELECT id FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2", [userId, d6.endpoint]);
            if (existS.rows[0]) { await pool.query("UPDATE push_subscriptions SET p256dh_key = $1, auth_key = $2, updated_at = NOW() WHERE id = $3", [d6.keys?.p256dh || "", d6.keys?.auth || "", existS.rows[0].id]); }
            else { await pool.query("INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh_key, auth_key) VALUES ($1,$2,$3,$4,$5)", [crypto.randomUUID(), userId, d6.endpoint, d6.keys?.p256dh || "", d6.keys?.auth || ""]); }
            result = { success: true };
            break;
          }
          case "push.removeSubscription": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            await pool.query("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2", [userId, (args?.data || {}).endpoint]);
            result = { success: true };
            break;
          }
          case "push.getSubscriptions": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT * FROM push_subscriptions WHERE user_id = $1", [userId])).rows;
            break;
          }
          // === integrations ===
          case "integrations.getConnectionUrl": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d7 = args?.data || {};
            const platforms: Record<string,{authUrl:string}> = { buildertrend:{authUrl:"https://buildertrend.com/oauth2/authorize"}, coconstruct:{authUrl:"https://api.coconstruct.com/oauth/authorize"}, procore:{authUrl:"https://login.procore.com/oauth/authorize"} };
            const p = platforms[d7.platform];
            if (!p) { res.statusCode = 400; res.end(JSON.stringify({ error: "Unknown platform" })); return; }
            const clientId = process.env[(d7.platform.toUpperCase())+"_CLIENT_ID"];
            if (!clientId) { res.statusCode = 500; res.end(JSON.stringify({ error: "Not configured" })); return; }
            const redir = (process.env.APP_URL || "https://site-delta-seven-64.vercel.app") + "/api/builder-auth?platform=" + d7.platform;
            result = { url: p.authUrl + "?client_id=" + clientId + "&redirect_uri=" + encodeURIComponent(redir) + "&response_type=code&state=" + userId + "&scope=read%20write" };
            break;
          }
          case "integrations.getConnectedPlatforms": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT platform, expires_at, created_at FROM builder_integrations WHERE user_id = $1", [userId])).rows.map((r:any)=>({ platform: r.platform, name: r.platform, connectedAt: r.created_at, expiresAt: r.expires_at }));
            break;
          }
          case "integrations.disconnectPlatform": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            await pool.query("DELETE FROM builder_integrations WHERE user_id = $1 AND platform = $2", [userId, (args?.data||{}).platform]);
            result = { success: true };
            break;
          }
          // === change orders ===
          case "changeOrders.list": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT co.*, e.project_name, e.customer_name FROM change_orders co JOIN estimates e ON e.id = co.estimate_id WHERE e.user_id = $1 ORDER BY co.created_at DESC", [userId])).rows;
            break;
          }
          case "changeOrders.get": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dco = args?.data || {};
            const co = (await pool.query("SELECT co.*, e.project_name, e.customer_name, e.total as estimate_total FROM change_orders co JOIN estimates e ON e.id = co.estimate_id WHERE co.id = $1 AND e.user_id = $2", [dco.id, userId])).rows[0];
            if (!co) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; }
            const items = (await pool.query("SELECT * FROM change_order_items WHERE change_order_id = $1 ORDER BY sort_order", [dco.id])).rows;
            const history = (await pool.query("SELECT * FROM change_order_history WHERE change_order_id = $1 ORDER BY created_at DESC", [dco.id])).rows;
            result = { ...co, items, history };
            break;
          }
          case "changeOrders.create": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dcc = args?.data || {};
            if (!dcc.estimateId || !dcc.title?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing estimateId or title" })); return; }
            const est = (await pool.query("SELECT id FROM estimates WHERE id=$1 AND user_id=$2", [dcc.estimateId, userId])).rows[0];
            if (!est) { res.statusCode = 404; res.end(JSON.stringify({ error: "Estimate not found" })); return; }
            const coId = crypto.randomUUID();
            await pool.query(
              "INSERT INTO change_orders (id, estimate_id, user_id, title, description, status, total_cost) VALUES ($1,$2,$3,$4,$5,'draft',$6)",
              [coId, dcc.estimateId, userId, dcc.title.trim(), dcc.description || "", 0]
            );
            await pool.query("INSERT INTO change_order_history (id, change_order_id, user_id, action, new_status) VALUES ($1,$2,$3,'created','draft')", [crypto.randomUUID(), coId, userId]);
            result = { id: coId };
            break;
          }
          case "changeOrders.update": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dcu = args?.data || {};
            const fields: string[] = [];
            const vals: any[] = [];
            let pj = 1;
            if (dcu.title !== undefined) { fields.push("title=$" + (pj++)); vals.push(dcu.title.trim()); }
            if (dcu.description !== undefined) { fields.push("description=$" + (pj++)); vals.push(dcu.description); }
            if (dcu.total_cost !== undefined) { fields.push("total_cost=$" + (pj++)); vals.push(parseFloat(dcu.total_cost) || 0); }
            fields.push("updated_at = NOW()");
            vals.push(dcu.id, userId);
            await pool.query("UPDATE change_orders SET " + fields.join(", ") + " WHERE id=$" + pj + " AND id IN (SELECT co.id FROM change_orders co JOIN estimates e ON e.id = co.estimate_id WHERE e.user_id=$" + (pj+1) + ")", vals);
            result = { success: true };
            break;
          }
          case "changeOrders.delete": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dcd = args?.data || {};
            await pool.query("DELETE FROM change_orders WHERE id = $1 AND id IN (SELECT co.id FROM change_orders co JOIN estimates e ON e.id = co.estimate_id WHERE e.user_id = $2)", [dcd.id, userId]);
            result = { success: true };
            break;
          }
          case "changeOrders.submit": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dcs = args?.data || {};
            await pool.query("UPDATE change_orders SET status = 'submitted', submitted_at = NOW(), updated_at = NOW() WHERE id = $1", [dcs.id]);
            await pool.query("INSERT INTO change_order_history (id, change_order_id, user_id, action, old_status, new_status) VALUES ($1,$2,$3,'submitted','draft','submitted')", [crypto.randomUUID(), dcs.id, userId]);
            result = { success: true };
            break;
          }
          case "changeOrders.approve": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dca = args?.data || {};
            const old = (await pool.query("SELECT status FROM change_orders WHERE id = $1", [dca.id])).rows[0];
            await pool.query("UPDATE change_orders SET status = 'approved', approved_at = NOW(), approved_by = $1, updated_at = NOW() WHERE id = $2", [userId, dca.id]);
            await pool.query("INSERT INTO change_order_history (id, change_order_id, user_id, action, old_status, new_status, comment) VALUES ($1,$2,$3,'approved',$4,'approved',$5)", [crypto.randomUUID(), dca.id, userId, old?.status || "", dca.comment || ""]);
            result = { success: true };
            break;
          }
          case "changeOrders.reject": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dcr = args?.data || {};
            const old2 = (await pool.query("SELECT status FROM change_orders WHERE id = $1", [dcr.id])).rows[0];
            await pool.query("UPDATE change_orders SET status = 'rejected', rejected_at = NOW(), rejected_by = $1, reject_reason = $2, updated_at = NOW() WHERE id = $3", [userId, dcr.reason || "", dcr.id]);
            await pool.query("INSERT INTO change_order_history (id, change_order_id, user_id, action, old_status, new_status, comment) VALUES ($1,$2,$3,'rejected',$4,'rejected',$5)", [crypto.randomUUID(), dcr.id, userId, old2?.status || "", dcr.reason || ""]);
            result = { success: true };
            break;
          }
          case "changeOrders.saveItems": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dci = args?.data || {};
            await pool.query("DELETE FROM change_order_items WHERE change_order_id = $1", [dci.changeOrderId]);
            const items = dci.items || [];
            let total = 0;
            for (let i = 0; i < items.length; i++) {
              const it = items[i];
              const lineTotal = (it.quantity || 1) * (it.unit_cost || 0) * (1 + (it.markup_percent || 0) / 100);
              total += lineTotal;
              await pool.query(
                "INSERT INTO change_order_items (id, change_order_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                [crypto.randomUUID(), dci.changeOrderId, it.description, it.quantity || 1, it.unit || "each", it.unit_cost || 0, it.markup_percent || 0, i]
              );
            }
            await pool.query("UPDATE change_orders SET total_cost = $1, updated_at = NOW() WHERE id = $2", [Math.round(total * 100) / 100, dci.changeOrderId]);
            result = { success: true, total: Math.round(total * 100) / 100 };
            break;
          }
          case "changeOrders.getCostDiff": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dcd2 = args?.data || {};
            const co = (await pool.query("SELECT co.*, e.total as estimate_total FROM change_orders co JOIN estimates e ON e.id = co.estimate_id WHERE co.id = $1 AND e.user_id = $2", [dcd2.id, userId])).rows[0];
            if (!co) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; }
            const diff = (co.total_cost || 0) - (co.estimate_total || 0);
            result = { estimateTotal: co.estimate_total || 0, changeTotal: co.total_cost || 0, difference: Math.round(diff * 100) / 100, percentChange: co.estimate_total ? Math.round((diff / co.estimate_total) * 10000) / 100 : 0 };
            break;
          }
          // === change order templates ===
          case "changeOrders.listTemplates": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT * FROM change_order_templates WHERE user_id = $1 ORDER BY name", [userId])).rows;
            break;
          }
          case "changeOrders.saveTemplate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dct = args?.data || {};
            await pool.query(
              "INSERT INTO change_order_templates (id, user_id, name, description, trade, items_json) VALUES ($1,$2,$3,$4,$5,$6)",
              [crypto.randomUUID(), userId, dct.name.trim(), dct.description || "", dct.trade || "", JSON.stringify(dct.items || [])]
            );
            result = { success: true };
            break;
          }
          case "changeOrders.deleteTemplate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dcdt = args?.data || {};
            await pool.query("DELETE FROM change_order_templates WHERE id = $1 AND user_id = $2", [dcdt.id, userId]);
            result = { success: true };
            break;
          }
          case "changeOrders.applyTemplate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dcat = args?.data || {};
            const tmpl = (await pool.query("SELECT * FROM change_order_templates WHERE id = $1", [dcat.templateId])).rows[0];
            if (!tmpl) { res.statusCode = 404; res.end(JSON.stringify({ error: "Template not found" })); return; }
            const coId2 = crypto.randomUUID();
            const items = JSON.parse(tmpl.items_json || "[]");
            let total2 = 0;
            await pool.query("INSERT INTO change_orders (id, estimate_id, user_id, title, description, status) VALUES ($1,$2,$3,$4,$5,'draft')", [coId2, dcat.estimateId, userId, tmpl.name, tmpl.description || ""]);
            for (let i = 0; i < items.length; i++) {
              const it = items[i];
              total2 += (it.quantity || 1) * (it.unit_cost || 0) * (1 + (it.markup_percent || 0) / 100);
              await pool.query("INSERT INTO change_order_items (id, change_order_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [crypto.randomUUID(), coId2, it.description, it.quantity || 1, it.unit || "each", it.unit_cost || 0, it.markup_percent || 0, i]);
            }
            await pool.query("UPDATE change_orders SET total_cost = $1 WHERE id = $2", [Math.round(total2 * 100) / 100, coId2]);
            await pool.query("INSERT INTO change_order_history (id, change_order_id, user_id, action, new_status) VALUES ($1,$2,$3,'created_from_template','draft')", [crypto.randomUUID(), coId2, userId]);
            result = { id: coId2 };
            break;
          }
          // === materials ===
          case "materials.listMaterials": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT m.*, s.name as supplier_name FROM materials m LEFT JOIN suppliers s ON s.id = m.supplier_id WHERE m.user_id = $1 ORDER BY m.name", [userId])).rows;
            break;
          }
          case "materials.importMaterials": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d10 = args?.data || {};
            const rows2 = d10.rows || [];
            let imported = 0;
            for (const r of rows2) {
              await pool.query("INSERT INTO materials (id, user_id, name, unit, unit_cost, category, supplier) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING", [crypto.randomUUID(), userId, r.name || "", r.unit || "ea", parseFloat(r.unit_cost) || 0, r.category || "", r.supplier || ""]);
              imported++;
            }
            result = { imported, total: rows2.length };
            break;
          }
          case "materials.getPriceHistory": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dph = args?.data || {};
            result = (await pool.query("SELECT * FROM material_price_history WHERE material_id = $1 AND material_id IN (SELECT id FROM materials WHERE user_id = $2) ORDER BY changed_at DESC", [dph.materialId, userId])).rows;
            break;
          }
          case "materials.bulkUpdate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dbu = args?.data || {};
            const ids = dbu.ids || [];
            const updates = dbu.updates || {};
            if (ids.length === 0) { res.statusCode = 400; res.end(JSON.stringify({ error: "No IDs" })); return; }
            const fields: string[] = [];
            const vals: any[] = [];
            let pi = 1;
            if (updates.trade !== undefined) { fields.push("trade=$" + (pi++)); vals.push(updates.trade); }
            if (updates.category !== undefined) { fields.push("category=$" + (pi++)); vals.push(updates.category); }
            if (updates.supplier_id !== undefined) { fields.push("supplier_id=$" + (pi++)); vals.push(updates.supplier_id); }
            if (updates.unit_cost !== undefined) {
              fields.push("unit_cost=$" + (pi++)); vals.push(parseFloat(updates.unit_cost));
              // Log price history for each
              for (const mid of ids) {
                const old = (await pool.query("SELECT unit_cost FROM materials WHERE id = $1", [mid])).rows[0];
                if (old && old.unit_cost !== parseFloat(updates.unit_cost)) {
                  await pool.query("INSERT INTO material_price_history (id, material_id, old_cost, new_cost, changed_by) VALUES ($1,$2,$3,$4,$5)", [crypto.randomUUID(), mid, old.unit_cost, parseFloat(updates.unit_cost), userId]);
                }
              }
            }
            fields.push("updated_at = NOW()");
            const placeholders = ids.map((_: any, i: number) => "$" + (pi + i)).join(",");
            vals.push(...ids, userId);
            await pool.query("UPDATE materials SET " + fields.join(", ") + " WHERE id IN (" + placeholders + ") AND user_id=$" + (pi + ids.length), vals);
            result = { success: true, updated: ids.length };
            break;
          }
          case "materials.bulkDelete": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dbd = args?.data || {};
            const ids2 = dbd.ids || [];
            if (ids2.length === 0) { res.statusCode = 400; res.end(JSON.stringify({ error: "No IDs" })); return; }
            const ph2 = ids2.map((_: any, i: number) => "$" + (i + 2)).join(",");
            await pool.query("DELETE FROM materials WHERE id IN (" + ph2 + ") AND user_id = $1", [userId, ...ids2]);
            result = { success: true, deleted: ids2.length };
            break;
          }
          case "materials.getPublicEstimate": {
            const d11 = args?.data || {};
            const est = (await pool.query("SELECT * FROM estimates WHERE id = $1", [d11.id])).rows[0];
            if (!est) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; }
            const items = (await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [d11.id])).rows;
            result = { estimate: est, items };
            break;
          }
          case "materials.savePublicSignature": {
            const d12 = args?.data || {};
            await pool.query("UPDATE estimates SET signature_data = $1, status = 'signed', signed_at = NOW() WHERE id = $2", [d12.signature || "", d12.estimateId]);
            result = { success: true };
            break;
          }
          // === invoices ===
          case "invoices.listInvoices": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT i.*, e.project_name, e.customer_name FROM invoices i JOIN estimates e ON e.id = i.estimate_id WHERE i.user_id = $1 ORDER BY i.created_at DESC", [userId])).rows;
            break;
          }
          case "invoices.getInvoice": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d13 = args?.data || {};
            const inv = (await pool.query("SELECT i.*, e.project_name, e.customer_name FROM invoices i JOIN estimates e ON e.id = i.estimate_id WHERE i.id = $1 AND i.user_id = $2", [d13.id, userId])).rows[0];
            if (!inv) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; }
            const items = (await pool.query("SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order", [d13.id])).rows;
            const reminders = (await pool.query("SELECT * FROM invoice_reminders WHERE invoice_id = $1 ORDER BY sent_at DESC", [d13.id])).rows;
            result = { ...inv, items, reminders };
            break;
          }
          case "invoices.createInvoice": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d4 = args?.data || {};
            if (!d4.estimateId) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing estimateId" })); return; }
            const est = (await pool.query("SELECT * FROM estimates WHERE id=$1 AND user_id=$2", [d4.estimateId, userId])).rows[0];
            if (!est) { res.statusCode = 404; res.end(JSON.stringify({ error: "Estimate not found" })); return; }
            const invId = crypto.randomUUID();
            const invNum = "INV-" + Date.now().toString(36).toUpperCase();
            const notes = d4.notes || "";
            await pool.query(
              "INSERT INTO invoices (id, user_id, estimate_id, invoice_number, status, due_date, notes, subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount, total) VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12,$13)",
              [invId, userId, d4.estimateId, invNum, d4.dueDate || null, notes, est.total || 0, d4.taxRate || 0, d4.taxRate ? (est.total||0)*(d4.taxRate/100) : 0, d4.discountType || "", d4.discountValue || 0, 0, est.total || 0]
            );
            // Copy line items from estimate
            const eItems = (await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [d4.estimateId])).rows;
            for (let i = 0; i < eItems.length; i++) {
              const it = eItems[i];
              await pool.query(
                "INSERT INTO invoice_items (id, invoice_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                [crypto.randomUUID(), invId, it.description, it.quantity, it.unit, it.unit_cost, it.markup_percent, i]
              );
            }
            result = { id: invId, invoice_number: invNum };
            break;
          }
          case "invoices.updateInvoice": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const du = args?.data || {};
            if (!du.id) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing id" })); return; }
            const fields: string[] = [];
            const vals: any[] = [];
            let pi = 1;
            if (du.dueDate !== undefined) { fields.push("due_date=$" + (pi++)); vals.push(du.dueDate); }
            if (du.notes !== undefined) { fields.push("notes=$" + (pi++)); vals.push(du.notes); }
            if (du.taxRate !== undefined) { fields.push("tax_rate=$" + (pi++)); vals.push(du.taxRate); }
            if (du.subtotal !== undefined) { fields.push("subtotal=$" + (pi++)); vals.push(du.subtotal); }
            if (du.taxAmount !== undefined) { fields.push("tax_amount=$" + (pi++)); vals.push(du.taxAmount); }
            if (du.discountType !== undefined) { fields.push("discount_type=$" + (pi++)); vals.push(du.discountType); }
            if (du.discountValue !== undefined) { fields.push("discount_value=$" + (pi++)); vals.push(du.discountValue); }
            if (du.discountAmount !== undefined) { fields.push("discount_amount=$" + (pi++)); vals.push(du.discountAmount); }
            if (du.total !== undefined) { fields.push("total=$" + (pi++)); vals.push(du.total); }
            if (du.status !== undefined) { fields.push("status=$" + (pi++)); vals.push(du.status); }
            fields.push("updated_at = NOW()");
            vals.push(du.id, userId);
            await pool.query("UPDATE invoices SET " + fields.join(", ") + " WHERE id=$" + pi + " AND user_id=$" + (pi+1), vals);
            result = { success: true };
            break;
          }
          case "invoices.deleteInvoice": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dd = args?.data || {};
            await pool.query("DELETE FROM invoices WHERE id = $1 AND user_id = $2", [dd.id, userId]);
            result = { success: true };
            break;
          }
          case "invoices.updateInvoiceStatus": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d14 = args?.data || {};
            const updates: string[] = ["status = $1", "updated_at = NOW()"];
            const vals: any[] = [d14.status];
            if (d14.status === "paid") { updates.push("paid_at = NOW()"); }
            vals.push(d14.id, userId);
            await pool.query("UPDATE invoices SET " + updates.join(", ") + " WHERE id = $2 AND user_id = $3", vals);
            result = { success: true };
            break;
          }
          case "invoices.getInvoiceStats": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const counts = (await pool.query(
              "SELECT status, COUNT(*) as count FROM invoices WHERE user_id=$1 GROUP BY status", [userId]
            )).rows;
            const out: Record<string,number> = { all: 0, draft: 0, sent: 0, paid: 0, overdue: 0 };
            for (const r of counts) { out[r.status] = parseInt(r.count); out.all += parseInt(r.count); }
            result = out;
            break;
          }
          case "invoices.getInvoiceItems": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const di = args?.data || {};
            result = (await pool.query("SELECT ii.* FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE ii.invoice_id = $1 AND i.user_id = $2 ORDER BY ii.sort_order", [di.invoiceId, userId])).rows;
            break;
          }
          case "invoices.saveInvoiceItems": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const ds = args?.data || {};
            // Verify ownership
            const own = (await pool.query("SELECT id FROM invoices WHERE id = $1 AND user_id = $2", [ds.invoiceId, userId])).rows[0];
            if (!own) { res.statusCode = 404; res.end(JSON.stringify({ error: "Invoice not found" })); return; }
            await pool.query("DELETE FROM invoice_items WHERE invoice_id = $1", [ds.invoiceId]);
            const items = ds.items || [];
            for (let i = 0; i < items.length; i++) {
              const it = items[i];
              await pool.query(
                "INSERT INTO invoice_items (id, invoice_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                [crypto.randomUUID(), ds.invoiceId, it.description, it.quantity || 1, it.unit || "each", it.unit_cost || 0, it.markup_percent || 0, i]
              );
            }
            result = { success: true };
            break;
          }
          case "invoices.generatePdf": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dg = args?.data || {};
            const inv = (await pool.query("SELECT i.*, e.project_name, e.customer_name FROM invoices i JOIN estimates e ON e.id = i.estimate_id WHERE i.id = $1 AND i.user_id = $2", [dg.id, userId])).rows[0];
            if (!inv) { res.statusCode = 404; res.end(JSON.stringify({ error: "Invoice not found" })); return; }
            const items = (await pool.query("SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order", [dg.id])).rows;
            const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
            const pdfDoc = await PDFDocument.create();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            let page = pdfDoc.addPage([612, 792]);
            let y = 720;
            const draw = (text: string, x: number, opts: any = {}) => { page.drawText(text, { x, y, size: opts.size || 10, font: opts.bold ? fontBold : font, color: opts.color || rgb(0,0,0) }); };
            draw("INVOICE", 50, { size: 18, bold: true }); y -= 24;
            draw("Invoice #: " + (inv.invoice_number || ""), 50, { size: 11 }); y -= 14;
            draw("Date: " + new Date(inv.created_at).toLocaleDateString(), 50, { size: 10 }); y -= 14;
            draw("Due: " + (inv.due_date || "—"), 50, { size: 10 }); y -= 24;
            draw("To: " + (inv.customer_name || ""), 50, { size: 11, bold: true }); y -= 14;
            draw("Project: " + (inv.project_name || ""), 50, { size: 10 }); y -= 28;
            // Items table header
            draw("Description", 50, { size: 9, bold: true });
            draw("Qty", 360, { size: 9, bold: true });
            draw("Unit", 400, { size: 9, bold: true });
            draw("Rate", 450, { size: 9, bold: true });
            draw("Total", 510, { size: 9, bold: true });
            y -= 16;
            for (const it of items) {
              const lineTotal = (it.quantity || 1) * (it.unit_cost || 0) * (1 + (it.markup_percent || 0)/100);
              draw((it.description || "").substring(0, 35), 50, { size: 9 });
              draw(String(it.quantity || 1), 360, { size: 9 });
              draw(it.unit || "each", 400, { size: 9 });
              draw("$" + Number(it.unit_cost || 0).toFixed(2), 450, { size: 9 });
              draw("$" + lineTotal.toFixed(2), 510, { size: 9 });
              y -= 14;
              if (y < 120) { page = pdfDoc.addPage([612, 792]); y = 750; }
            }
            // Totals
            y -= 8;
            draw("Subtotal: $" + Number(inv.subtotal || 0).toFixed(2), 400, { size: 10, bold: true }); y -= 14;
            if (inv.discount_type && Number(inv.discount_value) > 0) {
              const discLabel = inv.discount_type === "percentage" ? "Discount (" + inv.discount_value + "%)" : "Discount (fixed)";
              draw(discLabel + ": -$" + Number(inv.discount_amount || 0).toFixed(2), 400, { size: 10 }); y -= 14;
            }
            if (Number(inv.tax_rate) > 0) {
              draw("Tax (" + inv.tax_rate + "%): $" + Number(inv.tax_amount || 0).toFixed(2), 400, { size: 10 }); y -= 14;
            }
            draw("Total: $" + Number(inv.total || 0).toFixed(2), 400, { size: 12, bold: true }); y -= 28;
            if (inv.notes) {
              draw("Notes: " + inv.notes, 50, { size: 9 });
            }
            const pdfBytes = await pdfDoc.save();
            const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
            await pool.query("UPDATE invoices SET pdf_data = $1, updated_at = NOW() WHERE id = $2", [pdfBase64, dg.id]);
            result = { pdfBase64, invoiceNumber: inv.invoice_number };
            break;
          }
          case "invoices.sendReminder": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dr = args?.data || {};
            const inv = (await pool.query("SELECT i.*, e.project_name, e.customer_name, u.email as user_email FROM invoices i JOIN estimates e ON e.id = i.estimate_id JOIN users u ON u.id = i.user_id WHERE i.id = $1 AND i.user_id = $2", [dr.id, userId])).rows[0];
            if (!inv) { res.statusCode = 404; res.end(JSON.stringify({ error: "Invoice not found" })); return; }
            const reminderId = crypto.randomUUID();
            await pool.query(
              "INSERT INTO invoice_reminders (id, invoice_id, sent_by, sent_to, status) VALUES ($1,$2,$3,$4,'sent')",
              [reminderId, dr.id, userId, inv.customer_name || ""]
            );
            result = { success: true, reminderId };
            break;
          }
          // === recurring invoices ===
          case "recurringInvoices.list": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT ri.*, e.project_name, e.customer_name FROM recurring_invoices ri LEFT JOIN estimates e ON e.id = ri.estimate_id WHERE ri.user_id = $1 ORDER BY ri.next_date", [userId])).rows;
            break;
          }
          case "recurringInvoices.create": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const drc = args?.data || {};
            const id = crypto.randomUUID();
            await pool.query(
              "INSERT INTO recurring_invoices (id, user_id, estimate_id, name, frequency, next_date, amount, status, template_data) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8)",
              [id, userId, drc.estimateId || null, drc.name, drc.frequency || "monthly", drc.nextDate, drc.amount || 0, drc.templateData || "{}"]
            );
            result = { id };
            break;
          }
          case "recurringInvoices.update": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dru = args?.data || {};
            const fields2: string[] = [];
            const vals2: any[] = [];
            let pj = 1;
            if (dru.name !== undefined) { fields2.push("name=$" + (pj++)); vals2.push(dru.name); }
            if (dru.frequency !== undefined) { fields2.push("frequency=$" + (pj++)); vals2.push(dru.frequency); }
            if (dru.nextDate !== undefined) { fields2.push("next_date=$" + (pj++)); vals2.push(dru.nextDate); }
            if (dru.amount !== undefined) { fields2.push("amount=$" + (pj++)); vals2.push(dru.amount); }
            if (dru.status !== undefined) { fields2.push("status=$" + (pj++)); vals2.push(dru.status); }
            if (dru.templateData !== undefined) { fields2.push("template_data=$" + (pj++)); vals2.push(dru.templateData); }
            fields2.push("updated_at = NOW()");
            vals2.push(dru.id, userId);
            await pool.query("UPDATE recurring_invoices SET " + fields2.join(", ") + " WHERE id=$" + pj + " AND user_id=$" + (pj+1), vals2);
            result = { success: true };
            break;
          }
          case "recurringInvoices.delete": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const drd = args?.data || {};
            await pool.query("DELETE FROM recurring_invoices WHERE id = $1 AND user_id = $2", [drd.id, userId]);
            result = { success: true };
            break;
          }
          // === customers ===
          // === customers ===
          case "customers.list": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT c.*, (SELECT COUNT(*) FROM contracts WHERE customer_id = c.id) as contract_count FROM customers c WHERE c.user_id = $1 ORDER BY c.name", [userId])).rows;
            break;
          }
          case "customers.get": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dc = args?.data || {};
            const cust = (await pool.query("SELECT * FROM customers WHERE id = $1 AND user_id = $2", [dc.id, userId])).rows[0];
            if (!cust) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; }
            const cons = (await pool.query("SELECT * FROM contracts WHERE customer_id = $1 AND user_id = $2 ORDER BY created_at DESC", [dc.id, userId])).rows;
            result = { ...cust, contracts: cons };
            break;
          }
          case "customers.create": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dc2 = args?.data || {};
            if (!dc2.name?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Name required" })); return; }
            await pool.query(
              "INSERT INTO customers (id, user_id, name, email, phone, address, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)",
              [crypto.randomUUID(), userId, dc2.name.trim(), dc2.email || "", dc2.phone || "", dc2.address || "", dc2.notes || ""]
            );
            result = { success: true };
            break;
          }
          case "customers.update": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dc3 = args?.data || {};
            await pool.query(
              "UPDATE customers SET name=$1, email=$2, phone=$3, address=$4, notes=$5, updated_at=NOW() WHERE id=$6 AND user_id=$7",
              [dc3.name?.trim() || "", dc3.email || "", dc3.phone || "", dc3.address || "", dc3.notes || "", dc3.id, userId]
            );
            result = { success: true };
            break;
          }
          case "customers.delete": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dc4d = args?.data || {};
            await pool.query("DELETE FROM customers WHERE id = $1 AND user_id = $2", [dc4d.id, userId]);
            result = { success: true };
            break;
          }
          // === contracts ===
          case "contracts.list": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT c.*, cu.name as customer_display_name FROM contracts c LEFT JOIN customers cu ON cu.id = c.customer_id WHERE c.user_id = $1 ORDER BY c.created_at DESC", [userId])).rows;
            break;
          }
          case "contracts.create": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dcn = args?.data || {};
            if (!dcn.customer_name?.trim() || !dcn.project_name?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing fields" })); return; }
            await pool.query(
              "INSERT INTO contracts (id, user_id, customer_name, customer_id, project_name, trade, status, frequency, scope_of_work, start_date, end_date, amount, auto_renew, renewal_notice_days, estimate_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
              [crypto.randomUUID(), userId, dcn.customer_name.trim(), dcn.customer_id || null, dcn.project_name.trim(), dcn.trade || "general", "active", dcn.frequency || "quarterly", dcn.scope_of_work || "", dcn.start_date, dcn.end_date || "", parseFloat(dcn.amount) || 0, dcn.auto_renew || false, dcn.renewal_notice_days || 30, dcn.estimate_id || null]
            );
            result = { success: true };
            break;
          }
          case "contracts.update": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dcu2 = args?.data || {};
            const fields: string[] = [];
            const vals: any[] = [];
            let px = 1;
            const mappings: [string, string][] = [
              ["customer_name", "customer_name"], ["customer_id", "customer_id"], ["project_name", "project_name"],
              ["trade", "trade"], ["frequency", "frequency"], ["scope_of_work", "scope_of_work"],
              ["start_date", "start_date"], ["end_date", "end_date"], ["amount", "amount"],
              ["auto_renew", "auto_renew"], ["renewal_notice_days", "renewal_notice_days"], ["next_visit_date", "next_visit_date"],
            ];
            for (const [k, col] of mappings) {
              if (dcu2[k] !== undefined) { fields.push(col + "=$" + (px++)); vals.push(dcu2[k]); }
            }
            fields.push("updated_at = NOW()");
            vals.push(dcu2.id, userId);
            await pool.query("UPDATE contracts SET " + fields.join(", ") + " WHERE id=$" + px + " AND user_id=$" + (px+1), vals);
            result = { success: true };
            break;
          }
          case "contracts.delete": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dcd3 = args?.data || {};
            await pool.query("DELETE FROM contracts WHERE id = $1 AND user_id = $2", [dcd3.id, userId]);
            result = { success: true };
            break;
          }
          case "contracts.addNote": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dn = args?.data || {};
            await pool.query("INSERT INTO contract_notes (id, contract_id, user_id, note) VALUES ($1,$2,$3,$4)", [crypto.randomUUID(), dn.contractId, userId, dn.note]);
            result = { success: true };
            break;
          }
          case "contracts.getContractNotes": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dgn = args?.data || {};
            result = (await pool.query("SELECT * FROM contract_notes WHERE contract_id = $1 ORDER BY created_at DESC", [dgn.contractId])).rows;
            break;
          }
          case "contracts.getContract": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d15 = args?.data || {};
            const ct = (await pool.query("SELECT * FROM contracts WHERE id = $1 AND user_id = $2", [d15.id, userId])).rows[0];
            if (!ct) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; }
            const visits = (await pool.query("SELECT * FROM contract_visits WHERE contract_id = $1 ORDER BY scheduled_date", [d15.id])).rows;
            result = { contract: ct, visits };
            break;
          }
          case "contracts.generateNextVisit": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d16 = args?.data || {};
            const lastV = (await pool.query("SELECT scheduled_date FROM contract_visits WHERE contract_id = $1 ORDER BY scheduled_date DESC LIMIT 1", [d16.contractId])).rows[0];
            const base = lastV?.scheduled_date ? new Date(lastV.scheduled_date) : new Date();
            const nd = new Date(base.getTime() + 30*86400000).toISOString().split("T")[0];
            const vid = crypto.randomUUID();
            await pool.query("INSERT INTO contract_visits (id, contract_id, scheduled_date) VALUES ($1,$2,$3)", [vid, d16.contractId, nd]);
            result = { nextVisitDate: nd, visitId: vid };
            break;
          }
          case "contracts.completeVisit": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d17 = args?.data || {};
            await pool.query("UPDATE contract_visits SET status = 'completed', notes = $1, completed_at = NOW() WHERE id = $2", [d17.notes || "", d17.visitId]);
            result = { success: true };
            break;
          }
          case "contracts.updateContractStatus": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d18 = args?.data || {};
            await pool.query("UPDATE contracts SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3", [d18.status, d18.id, userId]);
            result = { success: true };
            break;
          }
          case "contracts.getExpiringContracts": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT * FROM contracts WHERE user_id = $1 AND status = 'active' AND end_date != '' AND end_date <= CURRENT_DATE + INTERVAL '30 days' ORDER BY end_date", [userId])).rows;
            break;
          }
          case "contracts.logVisit": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d40 = args?.data || {};
            if (!d40.contractId || !d40.date?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Contract ID and date required" })); return; }
            await pool.query(
              "INSERT INTO contract_visits (id, contract_id, scheduled_date, notes, status) VALUES ($1,$2,$3,$4,$5)",
              [crypto.randomUUID(), d40.contractId, d40.date.trim(), d40.notes || "", d40.status || "completed"]
            );
            result = { success: true };
            break;
          }
          // === email automations ===
          case "emailAutomations.getAutomations": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const types = ["proposal_followup", "won_thankyou", "invoice_reminder"];
            const out: any = {};
            for (const type of types) {
              const r2 = await pool.query("SELECT * FROM email_automations WHERE user_id = $1 AND type = $2", [userId, type]);
              out[type] = r2.rows[0] || { enabled: true, template: "", type };
            }
            result = out;
            break;
          }
          case "emailAutomations.saveAutomation": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d19 = args?.data || {};
            const exist2 = await pool.query("SELECT id FROM email_automations WHERE user_id = $1 AND type = $2", [userId, d19.type]);
            if (exist2.rows[0]) { await pool.query("UPDATE email_automations SET enabled = $1, template = $2 WHERE id = $3", [d19.enabled ? 1 : 0, d19.template || "", exist2.rows[0].id]); }
            else { await pool.query("INSERT INTO email_automations (id, user_id, type, enabled, template) VALUES ($1,$2,$3,$4,$5)", [crypto.randomUUID(), userId, d19.type, d19.enabled ? 1 : 0, d19.template || ""]); }
            result = { success: true };
            break;
          }
          case "emailAutomations.checkAutomations": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const triggers: any[] = [];
            const unopened = (await pool.query("SELECT e.id, e.project_name, e.customer_name FROM estimates e LEFT JOIN proposal_views pv ON pv.estimate_id = e.id WHERE e.user_id = $1 AND e.status = 'sent' AND e.created_at < NOW() - INTERVAL '3 days' AND pv.id IS NULL", [userId])).rows;
            for (const e of unopened) { const lr = await pool.query("SELECT id FROM automation_logs WHERE user_id = $1 AND type = 'proposal_followup' AND estimate_id = $2", [userId, e.id]); if (!lr.rows[0]) { await pool.query("INSERT INTO automation_logs (id, user_id, type, estimate_id) VALUES ($1,$2,$3,$4)", [crypto.randomUUID(), userId, "proposal_followup", e.id]); triggers.push({ type: "proposal_followup", estimateId: e.id, projectName: e.project_name, customerName: e.customer_name }); } }
            result = { triggers };
            break;
          }
          // === payments ===
          case "payments.createPaymentLink": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d20 = args?.data || {};
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (!stripeKey) { res.statusCode = 500; res.end(JSON.stringify({ error: "Stripe not configured" })); return; }
            const amountCents = Math.round((d20.amount || 0) * 100);
            const resp = await fetch("https://api.stripe.com/v1/payment_links", { method: "POST", headers: { Authorization: "Bearer " + stripeKey, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ "line_items[0][price_data][currency]": "usd", "line_items[0][price_data][product_data][name]": d20.description || "Invoice", "line_items[0][price_data][unit_amount]": String(amountCents), "line_items[0][quantity]": "1", "after_completion[type]": "redirect", "after_completion[redirect][url]": (process.env.APP_URL||"")+"/api/payment-confirm?invoice_id="+d20.invoiceId, "metadata[invoice_id]": d20.invoiceId, "metadata[user_id]": userId }) });
            const json = await resp.json() as any;
            if (!resp.ok) { res.statusCode = 500; res.end(JSON.stringify({ error: json.error?.message || "Stripe error" })); return; }
            await pool.query("UPDATE invoices SET pdf_data = CASE WHEN pdf_data IS NULL OR pdf_data = '' THEN $1 ELSE pdf_data END WHERE id = $2", [json.id, d20.invoiceId]);
            result = { url: json.url, id: json.id };
            break;
          }
          case "payments.createDepositLink": {
            const d21 = args?.data || {};
            const stripeKey2 = process.env.STRIPE_SECRET_KEY;
            if (!stripeKey2) { res.statusCode = 500; res.end(JSON.stringify({ error: "Stripe not configured" })); return; }
            const amountCents2 = Math.round((d21.amount || 0) * 100);
            const resp2 = await fetch("https://api.stripe.com/v1/payment_links", { method: "POST", headers: { Authorization: "Bearer " + stripeKey2, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ "line_items[0][price_data][currency]": "usd", "line_items[0][price_data][product_data][name]": d21.description || "Deposit", "line_items[0][price_data][unit_amount]": String(amountCents2), "line_items[0][quantity]": "1", "after_completion[type]": "redirect", "after_completion[redirect][url]": (process.env.APP_URL||"")+"/api/payment-confirm?estimate_id="+d21.estimateId+"&type=deposit", "metadata[estimate_id]": d21.estimateId, "metadata[type]": "deposit" }) });
            const json2 = await resp2.json() as any;
            if (!resp2.ok) { res.statusCode = 500; res.end(JSON.stringify({ error: json2.error?.message || "Stripe error" })); return; }
            result = { url: json2.url, id: json2.id };
            break;
          }
          // === subscriptions ===
          case "subscriptions.getStripeLink": {
            const d22 = args?.data || {};
            const links: Record<string,string> = { starter: "https://buy.stripe.com/dRmaEZ7ej5np8B8g5t57W0o", pro: "https://buy.stripe.com/8x29AVgOT4jl04C5qP57W0o", shop: "https://buy.stripe.com/7sYcN7fKPg23cRo8D157W0q" };
            result = { url: links[d22.plan] || links.starter };
            break;
          }
          case "subscriptions.getPlanPrices": {
            const d23 = args?.data || {};
            const prices: Record<string,{monthly:number;annual:number}> = { starter: { monthly: 49, annual: 39 }, pro: { monthly: 99, annual: 79 }, shop: { monthly: 199, annual: 159 } };
            result = prices[d23.plan] || prices.starter;
            break;
          }
          // === estimates detail ===
          case "estimates.getEstimate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d24 = args?.data || {};
            const estRow = (await pool.query("SELECT * FROM estimates WHERE id=$1 AND user_id=$2", [d24.id, userId])).rows[0];
            if (!estRow) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; }
            const items = (await pool.query("SELECT * FROM line_items WHERE estimate_id=$1 ORDER BY sort_order", [d24.id])).rows;
            result = { estimate: estRow, lineItems: items };
            break;
          }
          case "estimates.addLineItem": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d25 = args?.data || {};
            if (!d25.estimateId || !d25.description?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing fields" })); return; }
            const nextOrder = (await pool.query("SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM line_items WHERE estimate_id=$1", [d25.estimateId])).rows[0].next;
            await pool.query("INSERT INTO line_items (id, estimate_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
              [crypto.randomUUID(), d25.estimateId, d25.description.trim(), d25.quantity || 1, d25.unit || "each", d25.unitCost || 0, d25.markupPercent || 0, nextOrder]);
            result = { success: true };
            break;
          }
          case "estimates.removeLineItem": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d26 = args?.data || {};
            await pool.query("DELETE FROM line_items WHERE id=$1", [d26.id]);
            result = { success: true };
            break;
          }
          case "estimates.bulkDelete": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dBD = args?.data || {};
            const delIds = dBD.ids;
            if (!delIds || !Array.isArray(delIds) || delIds.length === 0) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing ids" })); return; }
            const plc = delIds.map((_:any,i:number) => "$" + (i+2)).join(",");
            const delSql = "DELETE FROM line_items WHERE estimate_id IN (" + plc + ")";
            await pool.query(delSql, delIds);
            const delSql2 = "DELETE FROM estimates WHERE id IN (" + plc + ") AND user_id=$" + (delIds.length+2);
            await pool.query(delSql2, [...delIds, userId]);
            result = { success: true, deleted: delIds.length };
            break;
          }
          case "estimates.updateTaxRate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dTax = args?.data || {};
            if (!dTax.id || dTax.taxRate === undefined) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing fields" })); return; }
            await pool.query("UPDATE estimates SET tax_rate=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3", [parseFloat(dTax.taxRate) || 0, dTax.id, userId]);
            result = { success: true };
            break;
          }
          case "estimates.updateLineItemTax": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dLit = args?.data || {};
            if (!dLit.id || dLit.taxRate === undefined) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing fields" })); return; }
            await pool.query("UPDATE line_items SET tax_rate=$1 WHERE id=$2", [parseFloat(dLit.taxRate) || 0, dLit.id]);
            result = { success: true };
            break;
          }
          case "estimates.updateLineItemMarkup": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dLim = args?.data || {};
            if (!dLim.id || dLim.markupPercent === undefined) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing fields" })); return; }
            await pool.query("UPDATE line_items SET markup_percent=$1 WHERE id=$2", [parseFloat(dLim.markupPercent) || 0, dLim.id]);
            result = { success: true };
            break;
          }
          case "estimates.saveVersion": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dVer = args?.data || {};
            if (!dVer.estimateId) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing estimateId" })); return; }
            const estV = (await pool.query("SELECT * FROM estimates WHERE id=$1 AND user_id=$2", [dVer.estimateId, userId])).rows[0];
            if (!estV) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; }
            const itemsV = (await pool.query("SELECT * FROM line_items WHERE estimate_id=$1 ORDER BY sort_order", [dVer.estimateId])).rows;
            const snapshot = JSON.stringify({ estimate: estV, lineItems: itemsV });
            const lastVer = (await pool.query("SELECT COALESCE(MAX(version_number), 0) + 1 as next FROM estimate_versions WHERE estimate_id=$1", [dVer.estimateId])).rows[0].next;
            await pool.query("INSERT INTO estimate_versions (id, estimate_id, user_id, snapshot, version_number) VALUES ($1,$2,$3,$4,$5)",
              [crypto.randomUUID(), dVer.estimateId, userId, snapshot, lastVer]);
            result = { success: true, versionNumber: lastVer };
            break;
          }
          case "estimates.getVersions": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dGv = args?.data || {};
            if (!dGv.estimateId) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing estimateId" })); return; }
            const vers = (await pool.query("SELECT id, version_number, user_id, created_at FROM estimate_versions WHERE estimate_id=$1 ORDER BY version_number DESC", [dGv.estimateId])).rows;
            result = { versions: vers };
            break;
          }
          case "estimates.getVersionSnapshot": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dGvs = args?.data || {};
            if (!dGvs.versionId) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing versionId" })); return; }
            const vrow = (await pool.query("SELECT * FROM estimate_versions WHERE id=$1", [dGvs.versionId])).rows[0];
            if (!vrow) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; }
            result = { version: vrow };
            break;
          }
          case "markups.listPresets": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const presets = (await pool.query("SELECT * FROM markup_presets WHERE user_id=$1 ORDER BY name", [userId])).rows;
            result = { presets };
            break;
          }
          case "markups.createPreset": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dMp = args?.data || {};
            if (!dMp.name?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing name" })); return; }
            await pool.query("INSERT INTO markup_presets (id, user_id, name, markup_percent) VALUES ($1,$2,$3,$4)",
              [crypto.randomUUID(), userId, dMp.name.trim(), parseFloat(dMp.markupPercent) || 40]);
            const presets2 = (await pool.query("SELECT * FROM markup_presets WHERE user_id=$1 ORDER BY name", [userId])).rows;
            result = { presets: presets2 };
            break;
          }
          case "markups.deletePreset": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dMdel = args?.data || {};
            if (!dMdel.id) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing id" })); return; }
            await pool.query("DELETE FROM markup_presets WHERE id=$1 AND user_id=$2", [dMdel.id, userId]);
            result = { success: true };
            break;
          }
          case "labor.listRates": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const lr = (await pool.query("SELECT * FROM labor_rates WHERE user_id=$1 ORDER BY name", [userId])).rows;
            result = { rates: lr };
            break;
          }
          case "labor.createRate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dLr = args?.data || {};
            if (!dLr.name?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing name" })); return; }
            await pool.query("INSERT INTO labor_rates (id, user_id, name, rate_per_hour, trade) VALUES ($1,$2,$3,$4,$5)",
              [crypto.randomUUID(), userId, dLr.name.trim(), parseFloat(dLr.ratePerHour) || 85, dLr.trade || ""]);
            const lr2 = (await pool.query("SELECT * FROM labor_rates WHERE user_id=$1 ORDER BY name", [userId])).rows;
            result = { rates: lr2 };
            break;
          }
          case "labor.deleteRate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dLdel = args?.data || {};
            if (!dLdel.id) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing id" })); return; }
            await pool.query("DELETE FROM labor_rates WHERE id=$1 AND user_id=$2", [dLdel.id, userId]);
            result = { success: true };
            break;
          }
          case "estimates.updateLineItemQty": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dLq = args?.data || {};
            if (!dLq.id || dLq.quantity === undefined) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing fields" })); return; }
            await pool.query("UPDATE line_items SET quantity=$1 WHERE id=$2", [parseFloat(dLq.quantity) || 1, dLq.id]);
            result = { success: true };
            break;
          }
          case "estimates.updateLineItemCost": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dLc = args?.data || {};
            if (!dLc.id || dLc.unitCost === undefined) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing fields" })); return; }
            await pool.query("UPDATE line_items SET unit_cost=$1 WHERE id=$2", [parseFloat(dLc.unitCost) || 0, dLc.id]);
            result = { success: true };
            break;
          }
          // === proposals ===
          case "proposals.generateProposal": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dProp = args?.data || {};
            if (!dProp.estimateId) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing estimateId" })); return; }
            const estP = (await pool.query("SELECT * FROM estimates WHERE id=$1 AND user_id=$2", [dProp.estimateId, userId])).rows[0];
            if (!estP) { res.statusCode = 404; res.end(JSON.stringify({ error: "Estimate not found" })); return; }
            const itemsP = (await pool.query("SELECT * FROM line_items WHERE estimate_id=$1 ORDER BY sort_order", [dProp.estimateId])).rows;
            const termsP = dProp.terms || "";
            const countP = (await pool.query("SELECT COUNT(*) as c FROM proposals WHERE user_id=$1", [userId])).rows[0];
            const proposalNumber = "PRO-" + String((parseInt(countP.c || "0")) + 1).padStart(4, "0");
            const proposalId = crypto.randomUUID();
            await pool.query("INSERT INTO proposals (id, estimate_id, user_id, proposal_number, terms) VALUES ($1,$2,$3,$4,$5)",
              [proposalId, dProp.estimateId, userId, proposalNumber, termsP]);
            // Generate PDF
            try {
              const userRow = (await pool.query("SELECT name, email FROM users WHERE id=$1", [userId])).rows[0];
              const doc = await PDFDocument.create();
              const font = await doc.embedFont(StandardFonts.Helvetica);
              const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
              const page = doc.addPage([612, 792]);
              const { width, height } = page.getSize();
              const indigoC = rgb(0.4, 0.24, 0.93), darkC = rgb(0.13, 0.13, 0.13), grayC = rgb(0.45, 0.45, 0.45);
              const lightGrayC = rgb(0.85, 0.85, 0.85), whiteC = rgb(1, 1, 1);
              let y = height - 50;
              page.drawText("BuildBid", { x: 50, y, size: 28, font: fontBold, color: indigoC });
              page.drawText("Professional Estimate Proposal", { x: 50, y: y - 24, size: 12, font, color: grayC });
              const todayStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
              page.drawText("Proposal #" + proposalNumber, { x: width - 200, y, size: 14, font: fontBold, color: darkC });
              page.drawText("Date: " + todayStr, { x: width - 200, y: y - 18, size: 10, font, color: grayC });
              y -= 60;
              page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: lightGrayC });
              y -= 20;
              page.drawText("CONTRACTOR", { x: 50, y, size: 10, font: fontBold, color: grayC });
              y -= 14;
              page.drawText(userRow?.name || userRow?.email || "", { x: 50, y, size: 12, font: fontBold, color: darkC });
              y -= 14;
              page.drawText(userRow?.email || "", { x: 50, y, size: 10, font, color: grayC });
              const clientX = width / 2;
              page.drawText("CLIENT", { x: clientX, y: y + 28, size: 10, font: fontBold, color: grayC });
              page.drawText(estP.customer_name, { x: clientX, y: y + 14, size: 12, font: fontBold, color: darkC });
              y -= 30;
              page.drawText("PROJECT", { x: 50, y, size: 10, font: fontBold, color: grayC });
              y -= 14;
              page.drawText(estP.project_name, { x: 50, y, size: 14, font: fontBold, color: darkC });
              page.drawText("Trade: " + (estP.trade?.charAt(0).toUpperCase() + estP.trade?.slice(1)), { x: clientX, y, size: 10, font, color: grayC });
              y -= 30;
              page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: lightGrayC });
              y -= 20;
              const cols = [{ x: 50, l: "Description" }, { x: 270, l: "Qty" }, { x: 310, l: "Unit" }, { x: 370, l: "Unit Cost" }, { x: 450, l: "Markup" }, { x: 500, l: "Total" }];
              page.drawRectangle({ x: 50, y: y - 4, width: width - 100, height: 22, color: indigoC });
              cols.forEach(c => { page.drawText(c.l, { x: c.x, y: y + 2, size: 9, font: fontBold, color: whiteC }); });
              y -= 22;
              let subtotalP = 0, grandTotalP = 0;
              for (const item of itemsP) {
                const lineTotal = (item.quantity * item.unit_cost) * (1 + (item.markup_percent || 0) / 100);
                subtotalP += item.quantity * item.unit_cost;
                grandTotalP += lineTotal;
                page.drawText(item.description, { x: 50, y, size: 10, font, color: darkC });
                page.drawText(String(item.quantity), { x: 270, y, size: 10, font, color: darkC });
                page.drawText(item.unit, { x: 310, y, size: 10, font, color: darkC });
                page.drawText("$" + Number(item.unit_cost).toFixed(2), { x: 370, y, size: 10, font, color: darkC });
                page.drawText((item.markup_percent || 0) + "%", { x: 450, y, size: 10, font, color: darkC });
                page.drawText("$" + lineTotal.toFixed(2), { x: 500, y, size: 10, font: fontBold, color: darkC });
                y -= 18;
              }
              y -= 10;
              page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: lightGrayC });
              y -= 16;
              page.drawText("Subtotal", { x: 400, y, size: 11, font, color: grayC });
              page.drawText("$" + subtotalP.toFixed(2), { x: 500, y, size: 11, font, color: darkC });
              y -= 18;
              page.drawText("Total", { x: 400, y, size: 14, font: fontBold, color: indigoC });
              page.drawText("$" + grandTotalP.toFixed(2), { x: 500, y, size: 14, font: fontBold, color: indigoC });
              y -= 40;
              page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: lightGrayC });
              y -= 20;
              if (termsP) {
                page.drawText("TERMS & NOTES", { x: 50, y, size: 10, font: fontBold, color: grayC });
                y -= 16;
                const words = termsP.split(" ");
                let line = "";
                for (const word of words) {
                  const test = line + word + " ";
                  if (test.length * 5 > 500) { page.drawText(line.trim(), { x: 50, y, size: 9, font, color: darkC }); y -= 14; line = word + " "; }
                  else { line = test; }
                }
                if (line.trim()) { page.drawText(line.trim(), { x: 50, y, size: 9, font, color: darkC }); }
              }
              const pdfBytes = await doc.save();
              const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
              await pool.query("UPDATE proposals SET pdf_data=$1 WHERE id=$2", [pdfBase64, proposalId]);
              result = { success: true, proposalId, proposalNumber, pdfBase64 };
            } catch (e: any) {
              console.error("[proposals.generateProposal] PDF error:", e.message);
              result = { success: true, proposalId, proposalNumber, pdfBase64: null };
            }
            break;
          }
          case "proposals.getProposals": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dGP = args?.data || {};
            const rows = (await pool.query("SELECT id, proposal_number, terms, created_at FROM proposals WHERE estimate_id=$1 AND user_id=$2 ORDER BY created_at DESC", [dGP.estimateId, userId])).rows;
            result = { proposals: rows };
            break;
          }
          case "proposals.getProposal": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dGP2 = args?.data || {};
            const row = (await pool.query("SELECT p.*, e.project_name, e.customer_name, e.trade FROM proposals p JOIN estimates e ON e.id=p.estimate_id WHERE p.id=$1 AND p.user_id=$2", [dGP2.id, userId])).rows[0];
            if (!row) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; }
            result = { proposal: row };
            break;
          }
          // === auth ===
          case "auth.requestPasswordReset": {
            const d27 = args?.data || {};
            if (!d27.email) { res.statusCode = 400; res.end(JSON.stringify({ error: "Email required" })); return; }
            const userRow = (await pool.query("SELECT id, email, name FROM users WHERE email=$1", [d27.email.trim().toLowerCase()])).rows[0];
            if (!userRow) { result = { success: true }; break; }
            await pool.query("DELETE FROM reset_tokens WHERE user_id=$1", [userRow.id]);
            const rtok = crypto.randomUUID();
            await pool.query("INSERT INTO reset_tokens (id, user_id, token, expires_at) VALUES ($1,$2,$3,$4)",
              [crypto.randomUUID(), userRow.id, rtok, new Date(Date.now() + 3600000).toISOString()]);
            const SITE_URL = process.env.SITE_URL || "https://buildbid.pro";
            try {
              await fetch(SITE_URL + "/api/send-email", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to: userRow.email, subject: "Reset your BuildBid password", body: "Hi " + (userRow.name || "there") + ",\n\nWe received a request to reset your BuildBid password.\n\nClick the link below to set a new password:\n" + SITE_URL + "/reset-password?token=" + rtok + "\n\nThis link expires in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.\n\n— The BuildBid Team" })
              });
            } catch (e) { /* email send failure is non-fatal */ }
            result = { success: true };
            break;
          }
          case "auth.validateResetToken": {
            const d28 = args?.data || {};
            if (!d28.token) { res.statusCode = 400; res.end(JSON.stringify({ error: "Token required" })); return; }
            const rrow = (await pool.query("SELECT user_id FROM reset_tokens WHERE token=$1 AND expires_at > NOW()", [d28.token])).rows[0];
            if (!rrow) { result = { valid: false }; }
            else { result = { valid: true, userId: rrow.user_id }; }
            break;
          }
          case "auth.resetPassword": {
            const d29 = args?.data || {};
            if (!d29.token || !d29.password || d29.password.length < 6) { res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid" })); return; }
            const rrow2 = (await pool.query("SELECT user_id FROM reset_tokens WHERE token=$1 AND expires_at > NOW()", [d29.token])).rows[0];
            if (!rrow2) { res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid or expired token" })); return; }
            const hash = bcrypt.hashSync(d29.password, 10);
            await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [hash, rrow2.user_id]);
            await pool.query("DELETE FROM reset_tokens WHERE user_id=$1", [rrow2.user_id]);
            await pool.query("DELETE FROM sessions WHERE user_id=$1", [rrow2.user_id]);
            result = { success: true };
            break;
          }
          case "auth.upgradeSubscription": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d30 = args?.data || {};
            if (!d30.tier || !["starter","pro","shop"].includes(d30.tier)) { res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid tier" })); return; }
            await pool.query("UPDATE users SET subscription_tier=$1 WHERE id=$2", [d30.tier, userId]);
            result = { success: true, tier: d30.tier };
            break;
          }
          // === integrations ===
          case "integrations.importBidsFromPlatform": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d31 = args?.data || {};
            const tokR = await pool.query("SELECT access_token, realm_id FROM builder_integrations WHERE user_id=$1 AND platform=$2", [userId, d31.platform]);
            if (!tokR.rows[0]) { res.statusCode = 400; res.end(JSON.stringify({ error: "Not connected" })); return; }
            const t = tokR.rows[0];
            const platform = (d31.platform === "buildertrend") ? { apiUrl: "https://buildertrend.com/api/v1", name: "Buildertrend" } : (d31.platform === "coconstruct") ? { apiUrl: "https://api.coconstruct.com/api/v1", name: "CoConstruct" } : { apiUrl: "https://api.procore.com/vapid", name: "Procore" };
            const resp = await fetch(platform.apiUrl + "/bids?status=open", { headers: { Authorization: "Bearer " + t.access_token } });
            if (!resp.ok) { res.statusCode = 500; res.end(JSON.stringify({ error: "Failed to fetch bids: " + resp.status })); return; }
            const bids = (await resp.json()) as any[];
            let imported2 = 0;
            for (const bid of bids) {
              const existR = await pool.query("SELECT id FROM estimates WHERE user_id=$1 AND project_name=$2 AND customer_name=$3", [userId, bid.job_name || bid.name, bid.customer_name || bid.contact_name || ""]);
              if (!existR.rows[0]) {
                await pool.query("INSERT INTO estimates (id, user_id, project_name, customer_name, trade, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)", [crypto.randomUUID(), userId, bid.job_name || bid.name, bid.customer_name || bid.contact_name || "", "general_contractor", "draft", "Imported from " + platform.name + ". Bid #" + (bid.number || bid.id)]);
                imported2++;
              }
            }
            result = { imported: imported2, total: bids.length };
            break;
          }
          // === price lists ===
          case "priceLists.getPriceLists": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT supplier, item_count, updated_at FROM price_lists WHERE user_id=$1 ORDER BY updated_at DESC", [userId])).rows;
            break;
          }
          case "priceLists.uploadPriceList": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d32 = args?.data || {};
            for (const item of d32.items || []) {
              const existR2 = await pool.query("SELECT id, unit_cost FROM materials WHERE name=$1 AND user_id=$2 AND supplier=$3", [item.name, userId, d32.supplier]);
              if (existR2.rows[0]) {
                await pool.query("UPDATE materials SET unit_cost=$1, unit=$2, trade=COALESCE($3, trade), updated_at=NOW() WHERE id=$4", [item.unit_cost, item.unit, item.trade || null, existR2.rows[0].id]);
              } else {
                await pool.query("INSERT INTO materials (id, user_id, name, unit, unit_cost, trade, supplier) VALUES ($1,$2,$3,$4,$5,$6,$7)", [crypto.randomUUID(), userId, item.name, item.unit, item.unit_cost, item.trade || "", d32.supplier]);
              }
            }
            await pool.query("INSERT INTO price_lists (supplier, user_id, item_count, updated_at) VALUES ($1,$2,$3,NOW()) ON CONFLICT (supplier, user_id) DO UPDATE SET item_count=$3, updated_at=NOW()", [d32.supplier, userId, (d32.items || []).length]);
            result = { count: (d32.items || []).length };
            break;
          }
          case "priceLists.getMaterialsBySupplier": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d33 = args?.data || {};
            result = (await pool.query("SELECT * FROM materials WHERE user_id=$1 AND supplier=$2 ORDER BY trade, name", [userId, d33.supplier])).rows;
            break;
          }
          // === materials CRUD ===
          case "materials.createMaterial": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d34 = args?.data || {};
            if (!d34.name?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Name required" })); return; }
            const mid = crypto.randomUUID();
            await pool.query(
              "INSERT INTO materials (id, user_id, name, description, unit, unit_cost, trade, category, supplier, supplier_id, inventory_qty, reorder_point, restock_qty) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
              [mid, userId, d34.name.trim(), d34.description || "", d34.unit || "each", parseFloat(d34.unit_cost) || 0, d34.trade || "", d34.category || "", d34.supplier || "", d34.supplier_id || null, parseFloat(d34.inventory_qty) || 0, parseFloat(d34.reorder_point) || 0, parseFloat(d34.restock_qty) || 0]
            );
            if (parseFloat(d34.unit_cost) > 0) {
              await pool.query("INSERT INTO material_price_history (id, material_id, old_cost, new_cost, changed_by) VALUES ($1,$2,$3,$4,$5)", [crypto.randomUUID(), mid, 0, parseFloat(d34.unit_cost) || 0, userId]);
            }
            result = { success: true, id: mid };
            break;
          }
          case "materials.updateMaterial": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d35 = args?.data || {};
            if (!d35.id) { res.statusCode = 400; res.end(JSON.stringify({ error: "ID required" })); return; }
            const oldCost = (await pool.query("SELECT unit_cost FROM materials WHERE id = $1 AND user_id = $2", [d35.id, userId])).rows[0];
            const newCost = parseFloat(d35.unit_cost);
            if (oldCost && newCost !== undefined && oldCost.unit_cost !== newCost) {
              await pool.query("INSERT INTO material_price_history (id, material_id, old_cost, new_cost, changed_by) VALUES ($1,$2,$3,$4,$5)", [crypto.randomUUID(), d35.id, oldCost.unit_cost, newCost, userId]);
            }
            await pool.query(
              "UPDATE materials SET name=$1, description=$2, unit=$3, unit_cost=$4, trade=$5, category=$6, supplier=$7, supplier_id=$8, inventory_qty=$9, reorder_point=$10, restock_qty=$11, updated_at=NOW() WHERE id=$12 AND user_id=$13",
              [d35.name?.trim() || "", d35.description || "", d35.unit || "each", isNaN(newCost) ? (oldCost?.unit_cost || 0) : newCost, d35.trade || "", d35.category || "", d35.supplier || "", d35.supplier_id || null, parseFloat(d35.inventory_qty) || 0, parseFloat(d35.reorder_point) || 0, parseFloat(d35.restock_qty) || 0, d35.id, userId]
            );
            result = { success: true };
            break;
          }
          case "materials.deleteMaterial": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d36 = args?.data || {};
            await pool.query("DELETE FROM materials WHERE id=$1 AND user_id=$2", [d36.id, userId]);
            result = { success: true };
            break;
          }
          // === suppliers ===
          case "suppliers.list": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT * FROM suppliers WHERE user_id = $1 ORDER BY name", [userId])).rows;
            break;
          }
          case "suppliers.create": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const ds = args?.data || {};
            if (!ds.name?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Name required" })); return; }
            await pool.query(
              "INSERT INTO suppliers (id, user_id, name, contact_name, email, phone, website, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
              [crypto.randomUUID(), userId, ds.name.trim(), ds.contact_name || "", ds.email || "", ds.phone || "", ds.website || "", ds.notes || ""]
            );
            result = { success: true };
            break;
          }
          case "suppliers.update": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dsu = args?.data || {};
            await pool.query(
              "UPDATE suppliers SET name=$1, contact_name=$2, email=$3, phone=$4, website=$5, notes=$6 WHERE id=$7 AND user_id=$8",
              [dsu.name?.trim() || "", dsu.contact_name || "", dsu.email || "", dsu.phone || "", dsu.website || "", dsu.notes || "", dsu.id, userId]
            );
            result = { success: true };
            break;
          }
          case "suppliers.delete": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dsd = args?.data || {};
            await pool.query("DELETE FROM suppliers WHERE id=$1 AND user_id=$2", [dsd.id, userId]);
            result = { success: true };
            break;
          }
          // === time entries ===
          case "timeEntries.listTimeEntries": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dte = args?.data || {};
            if (!dte.estimateId) { res.statusCode = 400; res.end(JSON.stringify({ error: "estimateId is required" })); return; }
            result = (await pool.query("SELECT id, description, hours, crew_member, date, created_at FROM time_entries WHERE estimate_id = $1 AND user_id = $2 ORDER BY date DESC, created_at DESC", [dte.estimateId, userId])).rows;
            result = { timeEntries: result };
            break;
          }
          case "timeEntries.createTimeEntry": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dte = args?.data || {};
            if (!dte.estimateId) { res.statusCode = 400; res.end(JSON.stringify({ error: "estimateId is required" })); return; }
            if (!dte.hours || dte.hours <= 0) { res.statusCode = 400; res.end(JSON.stringify({ error: "hours must be positive" })); return; }
            const est = (await pool.query("SELECT id FROM estimates WHERE id = $1 AND user_id = $2", [dte.estimateId, userId])).rows[0];
            if (!est) { res.statusCode = 404; res.end(JSON.stringify({ error: "Estimate not found" })); return; }
            const te = (await pool.query("INSERT INTO time_entries (estimate_id, user_id, description, hours, crew_member, date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, description, hours, crew_member, date, created_at", [dte.estimateId, userId, dte.description || "", dte.hours, dte.crewMember || "", dte.date || new Date().toISOString().slice(0,10)])).rows[0];
            result = { timeEntry: te };
            break;
          }
          case "timeEntries.deleteTimeEntry": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dte = args?.data || {};
            if (!dte.id) { res.statusCode = 400; res.end(JSON.stringify({ error: "id is required" })); return; }
            const dr = (await pool.query("DELETE FROM time_entries WHERE id = $1 AND user_id = $2 RETURNING id", [dte.id, userId])).rows[0];
            if (!dr) { res.statusCode = 404; res.end(JSON.stringify({ error: "Time entry not found" })); return; }
            result = { success: true };
            break;
          }
          case "timeEntries.getTimeSummary": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dte = args?.data || {};
            if (!dte.estimateId) { res.statusCode = 400; res.end(JSON.stringify({ error: "estimateId is required" })); return; }
            const summary = (await pool.query("SELECT COALESCE(SUM(hours), 0) as total_hours, COUNT(*) as entry_count FROM time_entries WHERE estimate_id = $1 AND user_id = $2", [dte.estimateId, userId])).rows[0];
            result = { totalHours: parseFloat(summary.total_hours), entryCount: parseInt(summary.entry_count) };
            break;
          }

          // === expenses ===
          case "expenses.listExpenses": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dx = args?.data || {};
            if (!dx.estimateId) { res.statusCode = 400; res.end(JSON.stringify({ error: "estimateId is required" })); return; }
            result = (await pool.query("SELECT id, description, amount, category, vendor, expense_date, receipt_url, notes, created_at FROM expenses WHERE estimate_id = $1 AND user_id = $2 ORDER BY expense_date DESC, created_at DESC", [dx.estimateId, userId])).rows;
            result = { expenses: result };
            break;
          }
          case "expenses.createExpense": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dx = args?.data || {};
            if (!dx.estimateId) { res.statusCode = 400; res.end(JSON.stringify({ error: "estimateId is required" })); return; }
            if (!dx.amount || parseFloat(dx.amount) <= 0) { res.statusCode = 400; res.end(JSON.stringify({ error: "amount must be positive" })); return; }
            const est = (await pool.query("SELECT id FROM estimates WHERE id = $1 AND user_id = $2", [dx.estimateId, userId])).rows[0];
            if (!est) { res.statusCode = 404; res.end(JSON.stringify({ error: "Estimate not found" })); return; }
            const exp = (await pool.query("INSERT INTO expenses (estimate_id, user_id, description, amount, category, vendor, expense_date, receipt_url, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, description, amount, category, vendor, expense_date, receipt_url, notes, created_at", [dx.estimateId, userId, dx.description || "", dx.amount, dx.category || "materials", dx.vendor || "", dx.expenseDate || new Date().toISOString().slice(0,10), dx.receiptUrl || null, dx.notes || ""])).rows[0];
            result = { expense: exp };
            break;
          }
          case "expenses.deleteExpense": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dx = args?.data || {};
            if (!dx.id) { res.statusCode = 400; res.end(JSON.stringify({ error: "id is required" })); return; }
            const dr = (await pool.query("DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id", [dx.id, userId])).rows[0];
            if (!dr) { res.statusCode = 404; res.end(JSON.stringify({ error: "Expense not found" })); return; }
            result = { success: true };
            break;
          }
          case "expenses.getExpenseSummary": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dx = args?.data || {};
            if (!dx.estimateId) { res.statusCode = 400; res.end(JSON.stringify({ error: "estimateId is required" })); return; }
            const totalResult = (await pool.query("SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(*) as expense_count FROM expenses WHERE estimate_id = $1 AND user_id = $2", [dx.estimateId, userId])).rows[0];
            const catResult = (await pool.query("SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE estimate_id = $1 AND user_id = $2 GROUP BY category ORDER BY total DESC", [dx.estimateId, userId])).rows;
            const estResult = (await pool.query("SELECT COALESCE(SUM(quantity * (unit_cost + (unit_cost * markup_percent / 100.0))), 0) as estimated_total FROM line_items WHERE estimate_id = $1", [dx.estimateId])).rows[0];
            const estTotal = parseFloat(estResult?.estimated_total || "0");
            result = { totalExpenses: parseFloat(totalResult.total_expenses), expenseCount: parseInt(totalResult.expense_count), estimatedTotal: estTotal, variance: estTotal - parseFloat(totalResult.total_expenses), byCategory: catResult.map((r) => ({ category: r.category, total: parseFloat(r.total), count: parseInt(r.count) })) };
            break;
          }

          // === customer portal: contractor management ===
          case "portalClient.listClientUsers": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const cuRows = (await pool.query("SELECT cu.id, cu.email, cu.name, cu.company_name, cu.active, cu.created_at, (SELECT COUNT(*) FROM estimates e WHERE e.client_user_id = cu.id) as estimate_count FROM client_users cu WHERE cu.user_id=$1 ORDER BY cu.created_at DESC", [userId])).rows;
            result = { clientUsers: cuRows };
            break;
          }
          case "portalClient.createClientUser": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dcu = args?.data || {};
            if (!dcu.email?.trim() || !dcu.password || dcu.password.length < 6) { res.statusCode = 400; res.end(JSON.stringify({ error: "Email and password (min 6 chars) are required" })); return; }
            const dup = (await pool.query("SELECT id FROM client_users WHERE user_id=$1 AND LOWER(email)=LOWER($2)", [userId, dcu.email.trim()])).rows[0];
            if (dup) { res.statusCode = 409; res.end(JSON.stringify({ error: "A portal user with this email already exists" })); return; }
            const cid = crypto.randomUUID();
            await pool.query("INSERT INTO client_users (id, user_id, email, password_hash, name, company_name) VALUES ($1,$2,$3,$4,$5,$6)",
              [cid, userId, dcu.email.trim(), bcrypt.hashSync(dcu.password, 10), dcu.name?.trim() || dcu.email.split("@")[0], dcu.companyName || ""]);
            result = { id: cid };
            break;
          }
          case "portalClient.updateClientUser": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const duu = args?.data || {};
            if (!duu.id) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing id" })); return; }
            const ufields: string[] = []; const uvals: any[] = [];
            if (duu.name !== undefined) { ufields.push("name=$"+(uvals.length+1)); uvals.push(duu.name.trim()); }
            if (duu.companyName !== undefined) { ufields.push("company_name=$"+(uvals.length+1)); uvals.push(duu.companyName); }
            if (duu.active !== undefined) { ufields.push("active=$"+(uvals.length+1)); uvals.push(duu.active ? 1 : 0); }
            if (ufields.length) { ufields.push("updated_at=NOW()"); uvals.push(duu.id, userId); await pool.query("UPDATE client_users SET "+ufields.join(", ")+" WHERE id=$"+(uvals.length-1)+" AND user_id=$"+(uvals.length), uvals); }
            result = { success: true };
            break;
          }
          case "portalClient.deleteClientUser": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const ddu = args?.data || {};
            if (!ddu.id) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing id" })); return; }
            await pool.query("UPDATE estimates SET client_user_id = NULL WHERE client_user_id = $1 AND user_id = $2", [ddu.id, userId]);
            await pool.query("DELETE FROM client_sessions WHERE client_user_id = $1", [ddu.id]);
            await pool.query("DELETE FROM client_users WHERE id = $1 AND user_id = $2", [ddu.id, userId]);
            result = { success: true };
            break;
          }
          case "portalClient.resetClientPassword": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dru = args?.data || {};
            if (!dru.id || !dru.password || dru.password.length < 6) { res.statusCode = 400; res.end(JSON.stringify({ error: "Password must be at least 6 characters" })); return; }
            await pool.query("UPDATE client_users SET password_hash=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3", [bcrypt.hashSync(dru.password, 10), dru.id, userId]);
            await pool.query("DELETE FROM client_sessions WHERE client_user_id = $1", [dru.id]);
            result = { success: true };
            break;
          }
          case "portalClient.listEstimates": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT id, project_name, customer_name, trade, status, client_user_id FROM estimates WHERE user_id=$1 ORDER BY updated_at DESC", [userId])).rows;
            break;
          }
          case "portalClient.linkEstimate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dlu2 = args?.data || {};
            if (!dlu2.estimateId || !dlu2.clientUserId) { res.statusCode = 400; res.end(JSON.stringify({ error: "estimateId and clientUserId required" })); return; }
            const ownsCu = (await pool.query("SELECT id FROM client_users WHERE id=$1 AND user_id=$2", [dlu2.clientUserId, userId])).rows[0];
            if (!ownsCu) { res.statusCode = 404; res.end(JSON.stringify({ error: "Client user not found" })); return; }
            await pool.query("UPDATE estimates SET client_user_id=$1 WHERE id=$2 AND user_id=$3", [dlu2.clientUserId, dlu2.estimateId, userId]);
            result = { success: true };
            break;
          }
          case "portalClient.unlinkEstimate": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dulu = args?.data || {};
            if (!dulu.estimateId) { res.statusCode = 400; res.end(JSON.stringify({ error: "estimateId required" })); return; }
            await pool.query("UPDATE estimates SET client_user_id=NULL WHERE id=$1 AND user_id=$2", [dulu.estimateId, userId]);
            result = { success: true };
            break;
          }
          // === customer portal: client-facing ===
          case "portal.getDashboard": {
            if (!clientUser) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const ests = (await pool.query("SELECT e.id, e.project_name, e.customer_name, e.trade, e.status, e.created_at, e.updated_at, e.signed_at, (SELECT COUNT(*) FROM change_orders co WHERE co.estimate_id=e.id) as change_order_count FROM estimates e WHERE e.client_user_id=$1 ORDER BY e.updated_at DESC", [clientUser.id])).rows;
            const withTotals = [];
            for (const est of ests) {
              const tot = (await pool.query("SELECT COALESCE(SUM((quantity*unit_cost)*(1+COALESCE(markup_percent,0)/100)),0) as t FROM line_items WHERE estimate_id=$1", [est.id])).rows[0].t;
              withTotals.push({ ...est, total: Math.round(parseFloat(tot || "0") * 100) / 100 });
            }
            const cos = (await pool.query("SELECT co.id, co.estimate_id, co.title, co.description, co.status, co.total_cost, co.created_at, co.updated_at, e.project_name, e.customer_name FROM change_orders co JOIN estimates e ON e.id=co.estimate_id WHERE e.client_user_id=$1 ORDER BY co.created_at DESC", [clientUser.id])).rows;
            result = { estimates: withTotals, changeOrders: cos };
            break;
          }
          case "portal.getEstimate": {
            if (!clientUser) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dpe = args?.data || {};
            const est = (await pool.query("SELECT * FROM estimates WHERE id=$1 AND client_user_id=$2", [dpe.estimateId, clientUser.id])).rows[0];
            if (!est) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; }
            const items = (await pool.query("SELECT * FROM line_items WHERE estimate_id=$1 ORDER BY sort_order", [dpe.estimateId])).rows;
            const total = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_cost) * (1 + (i.markup_percent || 0) / 100), 0);
            const props = (await pool.query("SELECT id, proposal_number, terms, created_at, pdf_data FROM proposals WHERE estimate_id=$1 ORDER BY created_at DESC", [dpe.estimateId])).rows;
            const cos2 = (await pool.query("SELECT co.*, (SELECT COALESCE(SUM((quantity*unit_cost)*(1+COALESCE(markup_percent,0)/100)),0) FROM change_order_items WHERE change_order_id=co.id) as calc_total FROM change_orders co WHERE co.estimate_id=$1 ORDER BY co.created_at DESC", [dpe.estimateId])).rows;
            result = { estimate: est, lineItems: items, total: Math.round(total * 100) / 100, proposals: props, changeOrders: cos2 };
            break;
          }
          case "portal.getChangeOrder": {
            if (!clientUser) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dco2 = args?.data || {};
            const co = (await pool.query("SELECT co.*, e.project_name, e.customer_name, e.id as estimate_id FROM change_orders co JOIN estimates e ON e.id=co.estimate_id WHERE co.id=$1 AND e.client_user_id=$2", [dco2.id, clientUser.id])).rows[0];
            if (!co) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; }
            const items = (await pool.query("SELECT * FROM change_order_items WHERE change_order_id=$1 ORDER BY sort_order", [dco2.id])).rows;
            result = { changeOrder: co, items };
            break;
          }
          case "portal.respondChangeOrder": {
            if (!clientUser) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dresp = args?.data || {};
            const co = (await pool.query("SELECT co.*, e.user_id as est_user_id, e.project_name FROM change_orders co JOIN estimates e ON e.id=co.estimate_id WHERE co.id=$1 AND e.client_user_id=$2", [dresp.changeOrderId, clientUser.id])).rows[0];
            if (!co) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; }
            if (co.status !== "sent" && co.status !== "submitted") { res.statusCode = 409; res.end(JSON.stringify({ error: "This change order is not awaiting a response" })); return; }
            const approved = !!dresp.approved;
            const newStatus = approved ? "approved" : "rejected";
            if (approved) {
              await pool.query("UPDATE change_orders SET status='approved', approved_at=NOW(), approved_by=$1, updated_at=NOW() WHERE id=$2", [co.est_user_id, dresp.changeOrderId]);
            } else {
              await pool.query("UPDATE change_orders SET status='rejected', rejected_at=NOW(), rejected_by=$1, reject_reason=$2, updated_at=NOW() WHERE id=$3", [co.est_user_id, dresp.reason || "", dresp.changeOrderId]);
            }
            await pool.query("INSERT INTO change_order_history (id, change_order_id, user_id, action, old_status, new_status, comment) VALUES ($1,$2,$3,$4,$5,$6,$7)",
              [crypto.randomUUID(), dresp.changeOrderId, co.est_user_id, approved ? "approved" : "rejected", co.status, newStatus, (clientUser.name || clientUser.email) + " via customer portal" + (dresp.reason ? ": " + dresp.reason : "")]);
            result = { status: newStatus };
            break;
          }
          case "portal.signEstimate": {
            if (!clientUser) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const dse = args?.data || {};
            if (!dse.estimateId || !dse.signatureData) { res.statusCode = 400; res.end(JSON.stringify({ error: "estimateId and signatureData are required" })); return; }
            const est = (await pool.query("SELECT id FROM estimates WHERE id=$1 AND client_user_id=$2", [dse.estimateId, clientUser.id])).rows[0];
            if (!est) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; }
            await pool.query("UPDATE estimates SET signature_data=$1, signed_at=NOW(), status=CASE WHEN status='draft' THEN 'sent' ELSE status END WHERE id=$2", [dse.signatureData, dse.estimateId]);
            result = { success: true };
            break;
          }
          default: { res.statusCode = 501; res.end(JSON.stringify({ error: "Unknown: " + fnName })); return; }
        }
        res.statusCode = 200; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(result));
      } catch (e: any) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message || "Internal error" })); }
      return;
    }
    // === Customer portal auth ===
    if (req.method === "POST" && url === "/api/portal/login") { const wr = await handleClientLogin(await readBody(req)); res.statusCode = wr.status; wr.headers.forEach((v: string, k: string) => res.setHeader(k, v)); res.end(await wr.text()); return; }
    if (req.method === "POST" && url === "/api/portal/logout") { const wr = await handleClientLogout(req); res.statusCode = wr.status; wr.headers.forEach((v: string, k: string) => res.setHeader(k, v)); res.end(await wr.text()); return; }
    if (req.method === "GET" && url === "/api/portal/me") { const wr = await handleClientMe(req); res.statusCode = wr.status; wr.headers.forEach((v: string, k: string) => res.setHeader(k, v)); res.end(await wr.text()); return; }
    // SSR — static import
    const webRes = await handler.fetch(toWebRequest(req));
    res.statusCode = webRes.status;
    webRes.headers.forEach((v: string, k: string) => res.setHeader(k, v));
    if (webRes.body) { const reader = (webRes.body as ReadableStream).getReader(); for (; ;) { const { done, value } = await reader.read(); if (done) { res.end(); break; } res.write(value); } } else { res.end(); }
  } catch (e: any) { console.error("SSR fail", e); res.statusCode = 500; res.end("Internal Server Error"); }
}
