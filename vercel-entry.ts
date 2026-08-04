// Vercel Build Output API - BuildBid
// Static SSR import + inline auth & /api/call handlers
import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import handler from "./dist/server/server.js";

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

async function handleSignup(body: any) {
  const { email, password, name } = body || {};
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
  await pool.query("INSERT INTO users (id, email, password_hash, name, subscription_tier, trial_ends_at, role) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [id, email, hash, name || "", "trial", trialEndsAt, role]);
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
  const r = await pool.query("SELECT id, email, name, password_hash FROM users WHERE email=$1", [email]);
  if (!r.rows[0]) return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: { "Content-Type": "application/json" } });
  if (!bcrypt.compareSync(password, r.rows[0].password_hash)) return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: { "Content-Type": "application/json" } });
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
  const r = await pool.query("SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.expires_at>NOW()", [token]);
  if (!r.rows[0]) return new Response(JSON.stringify({ user: null }), { status: 200, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ user: r.rows[0] }), { status: 200, headers: { "Content-Type": "application/json" } });
}
async function handleLogout(req: IncomingMessage) {
  const token = parseCookies(req)["buildbid_session"];
  if (token) { const pool = getPool(); await pool.query("DELETE FROM sessions WHERE id=$1", [token]); }
  const resp = new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  resp.headers.append("Set-Cookie", "buildbid_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return resp;
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
        `CREATE TABLE IF NOT EXISTS estimates (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, project_name TEXT NOT NULL, customer_name TEXT NOT NULL, trade TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', notes TEXT DEFAULT '', signature_data TEXT DEFAULT '', actual_material_cost REAL NOT NULL DEFAULT 0, actual_labor_cost REAL NOT NULL DEFAULT 0, actual_other_cost REAL NOT NULL DEFAULT 0, start_date TEXT DEFAULT '', end_date TEXT DEFAULT '', contract_id TEXT DEFAULT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS line_items (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit TEXT NOT NULL DEFAULT 'each', unit_cost REAL NOT NULL DEFAULT 0, markup_percent REAL NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, material_id TEXT DEFAULT NULL)`,
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
        `CREATE TABLE IF NOT EXISTS line_item_photos (id TEXT PRIMARY KEY, line_item_id TEXT NOT NULL REFERENCES line_items(id) ON DELETE CASCADE, filename TEXT NOT NULL, photo_data TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS change_orders (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, description TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS change_order_items (id TEXT PRIMARY KEY, change_order_id TEXT NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit TEXT NOT NULL DEFAULT 'each', unit_cost REAL NOT NULL DEFAULT 0, markup_percent REAL NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0)`,
      ];
      for (const t of appTables) {
        try { await pool.query(t); } catch (e) { console.error("App table create error:", e); }
      }

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
    // /api/call
    if (req.method === "POST" && url === "/api/call") {
      const body = await readBody(req);
      const fnName = body?.["function"];
      const args = body?.args || {};
      const cookies = parseCookies(req);
      const token = cookies["buildbid_session"];
      const pool = getPool();
      let userId = "";
      if (token) { const r = await pool.query("SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.expires_at>NOW()", [token]); if (r.rows[0]) userId = r.rows[0].id; }
      let result: any;
      try {
        switch (fnName) {
          case "templates.listTemplates": case "templates.getTemplates": { const trade = args?.data?.trade; const rows = trade ? (await pool.query("SELECT * FROM templates WHERE trade_type=$1 ORDER BY name", [trade])).rows : (await pool.query("SELECT * FROM templates ORDER BY trade_type, name")).rows; result = { templates: rows }; break; }
          case "templates.getTemplate": { const tpl = (await pool.query("SELECT * FROM templates WHERE id=$1", [args?.data?.id])).rows[0]; if (!tpl) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; } const items = (await pool.query("SELECT * FROM template_line_items WHERE template_id=$1 ORDER BY sort_order", [args?.data?.id])).rows; result = { template: tpl, items }; break; }
          case "templates.createEstimateFromTemplate": { if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; } const d = args?.data || {}; if (!d.templateId || !d.projectName?.trim() || !d.customerName?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing fields" })); return; } const tpl = (await pool.query("SELECT * FROM templates WHERE id=$1", [d.templateId])).rows[0]; if (!tpl) { res.statusCode = 404; res.end(JSON.stringify({ error: "Template not found" })); return; } const items = (await pool.query("SELECT * FROM template_line_items WHERE template_id=$1 ORDER BY sort_order", [d.templateId])).rows; const eid = crypto.randomUUID(); await pool.query("INSERT INTO estimates (id, user_id, project_name, customer_name, trade) VALUES ($1,$2,$3,$4,$5)", [eid, userId, d.projectName.trim(), d.customerName.trim(), tpl.trade_type]); for (const it of items) { await pool.query("INSERT INTO line_items (id, estimate_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,(SELECT COALESCE(MAX(sort_order),0)+1 FROM line_items WHERE estimate_id=$2))", [crypto.randomUUID(), eid, it.description, it.quantity, it.unit, it.unit_cost, it.markup_percent]); } result = { id: eid }; break; }
          case "templates.seedTemplates": { if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; } const adminCheck = await pool.query("SELECT role FROM users WHERE id=$1", [userId]); if (adminCheck.rows[0]?.role !== "admin") { res.statusCode = 403; res.end(JSON.stringify({ error: "Admin required" })); return; } const newTemplates = args?.data?.templates; if (!newTemplates || !Array.isArray(newTemplates)) { res.statusCode = 400; res.end(JSON.stringify({ error: "Provide templates array" })); return; } let seeded = 0; for (const t of newTemplates) { const exist = await pool.query("SELECT id FROM templates WHERE name=$1 LIMIT 1", [t.name]); if (exist.rows.length > 0) continue; const tid = crypto.randomUUID(); await pool.query("INSERT INTO templates (id, name, trade_type, description) VALUES ($1,$2,$3,$4)", [tid, t.name, t.trade_type, t.description]); for (let i = 0; i < t.items.length; i++) { const it = t.items[i]; await pool.query("INSERT INTO template_line_items (id, template_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [crypto.randomUUID(), tid, it.description, it.quantity, it.unit, it.unit_cost, it.markup_percent, i]); } seeded++; } result = { seeded, total: newTemplates.length }; break; }
          case "analytics.getDashboardStats": case "analytics.getAnalytics": { if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; } const stats = await pool.query("SELECT COUNT(*) as total, SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) as won, SUM(CASE WHEN status='lost' THEN 1 ELSE 0 END) as lost FROM estimates WHERE user_id=$1", [userId]); const s = stats.rows[0]; result = { total: parseInt(s?.total || "0"), won: parseInt(s?.won || "0"), lost: parseInt(s?.lost || "0"), winRate: parseInt(s?.total || "0") > 0 ? Math.round((parseInt(s?.won || "0") / (parseInt(s?.won || "0") + parseInt(s?.lost || "0") || 1)) * 100) : 0 }; break; }
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
          case "invoices.createInvoice": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d4 = args?.data || {};
            if (!d4.estimateId) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing estimateId" })); return; }
            const est = (await pool.query("SELECT * FROM estimates WHERE id=$1 AND user_id=$2", [d4.estimateId, userId])).rows[0];
            if (!est) { res.statusCode = 404; res.end(JSON.stringify({ error: "Estimate not found" })); return; }
            const invId = crypto.randomUUID();
            const invNum = "INV-" + Date.now().toString(36).toUpperCase();
            await pool.query(
              "INSERT INTO invoices (id, user_id, estimate_id, invoice_number, status, due_date, notes, total) VALUES ($1,$2,$3,$4,'draft',$5,$6,$7)",
              [invId, userId, d4.estimateId, invNum, d4.dueDate || null, d4.notes || "", est.total || 0]
            );
            result = { id: invId, invoice_number: invNum };
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
          case "changeOrders.listAllChangeOrders": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT co.*, e.project_name, e.customer_name FROM change_orders co JOIN estimates e ON e.id = co.estimate_id WHERE e.user_id = $1 ORDER BY co.created_at DESC", [userId])).rows;
            break;
          }
          case "changeOrders.getPublicChangeOrder": {
            const d8 = args?.data || {};
            const co = (await pool.query("SELECT co.*, e.project_name, e.customer_name FROM change_orders co JOIN estimates e ON e.id = co.estimate_id WHERE co.id = $1", [d8.id])).rows[0];
            if (!co) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; }
            result = co;
            break;
          }
          case "changeOrders.approveChangeOrder": {
            const d9 = args?.data || {};
            await pool.query("UPDATE change_orders SET status = 'approved', approved_at = NOW() WHERE id = $1", [d9.id]);
            result = { success: true };
            break;
          }
          // === materials ===
          case "materials.listMaterials": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT * FROM materials WHERE user_id = $1 ORDER BY name", [userId])).rows;
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
            result = inv;
            break;
          }
          case "invoices.updateInvoiceStatus": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d14 = args?.data || {};
            await pool.query("UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3", [d14.status, d14.id, userId]);
            result = { success: true };
            break;
          }
          // === customers ===
          case "customers.getCustomerList": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT DISTINCT ON (customer_name) customer_name, id, project_name, trade, status, created_at FROM estimates WHERE user_id = $1 AND customer_name != '' ORDER BY customer_name, created_at DESC", [userId])).rows;
            break;
          }
          // === contracts ===
          case "contracts.listContracts": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            result = (await pool.query("SELECT * FROM contracts WHERE user_id = $1 ORDER BY created_at DESC", [userId])).rows;
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
            await pool.query(
              "INSERT INTO materials (id, user_id, name, unit, unit_cost, trade, supplier) VALUES ($1,$2,$3,$4,$5,$6,$7)",
              [crypto.randomUUID(), userId, d34.name.trim(), d34.unit || "each", parseFloat(d34.unit_cost) || 0, d34.trade || "", d34.supplier || ""]
            );
            result = { success: true };
            break;
          }
          case "materials.updateMaterial": {
            if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; }
            const d35 = args?.data || {};
            if (!d35.id) { res.statusCode = 400; res.end(JSON.stringify({ error: "ID required" })); return; }
            await pool.query(
              "UPDATE materials SET name=$1, unit=$2, unit_cost=$3, trade=$4, supplier=$5, updated_at=NOW() WHERE id=$6 AND user_id=$7",
              [d35.name?.trim() || "", d35.unit || "each", parseFloat(d35.unit_cost) || 0, d35.trade || "", d35.supplier || "", d35.id, userId]
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
          default: { res.statusCode = 501; res.end(JSON.stringify({ error: "Unknown: " + fnName })); return; }
        }
        res.statusCode = 200; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(result));
      } catch (e: any) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message || "Internal error" })); }
      return;
    }
    // SSR — static import
    const webRes = await handler.fetch(toWebRequest(req));
    res.statusCode = webRes.status;
    webRes.headers.forEach((v: string, k: string) => res.setHeader(k, v));
    if (webRes.body) { const reader = (webRes.body as ReadableStream).getReader(); for (; ;) { const { done, value } = await reader.read(); if (done) { res.end(); break; } res.write(value); } } else { res.end(); }
  } catch (e: any) { console.error("SSR fail", e); res.statusCode = 500; res.end("Internal Server Error"); }
}
