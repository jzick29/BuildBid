// Vercel Build Output API - BuildBid
// Static SSR import + inline auth & /api/call handlers
import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "crypto";
import { Pool } from "@neondatabase/serverless";
import handler from "./dist/server/server.js";

const getPool = () => {
  if (!(globalThis as any).__buildbid_pool) {
    (globalThis as any).__buildbid_pool = new Pool({ connectionString: process.env.DATABASE_URL! });
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
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  await pool.query("INSERT INTO users (id, email, password_hash, name) VALUES ($1,$2,$3,$4)", [id, email, hash, name || ""]);
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
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  const r = await pool.query("SELECT id, email, name FROM users WHERE email=$1 AND password_hash=$2", [email, hash]);
  if (!r.rows[0]) return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: { "Content-Type": "application/json" } });
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
          case "templates.getTemplates": { const trade = args?.data?.trade; const rows = trade ? (await pool.query("SELECT * FROM templates WHERE trade_type=$1 ORDER BY name", [trade])).rows : (await pool.query("SELECT * FROM templates ORDER BY trade_type, name")).rows; result = { templates: rows }; break; }
          case "templates.getTemplate": { const tpl = (await pool.query("SELECT * FROM templates WHERE id=$1", [args?.data?.id])).rows[0]; if (!tpl) { res.statusCode = 404; res.end(JSON.stringify({ error: "Not found" })); return; } const items = (await pool.query("SELECT * FROM template_line_items WHERE template_id=$1 ORDER BY sort_order", [args?.data?.id])).rows; result = { template: tpl, items }; break; }
          case "templates.createEstimateFromTemplate": { if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; } const d = args?.data || {}; if (!d.templateId || !d.projectName?.trim() || !d.customerName?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing fields" })); return; } const tpl = (await pool.query("SELECT * FROM templates WHERE id=$1", [d.templateId])).rows[0]; if (!tpl) { res.statusCode = 404; res.end(JSON.stringify({ error: "Template not found" })); return; } const items = (await pool.query("SELECT * FROM template_line_items WHERE template_id=$1 ORDER BY sort_order", [d.templateId])).rows; const eid = crypto.randomUUID(); await pool.query("INSERT INTO estimates (id, user_id, project_name, customer_name, trade) VALUES ($1,$2,$3,$4,$5)", [eid, userId, d.projectName.trim(), d.customerName.trim(), tpl.trade_type]); for (const it of items) { await pool.query("INSERT INTO line_items (id, estimate_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,(SELECT COALESCE(MAX(sort_order),0)+1 FROM line_items WHERE estimate_id=$2))", [crypto.randomUUID(), eid, it.description, it.quantity, it.unit, it.unit_cost, it.markup_percent]); } result = { id: eid }; break; }
          case "analytics.getAnalytics": { if (!userId) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated" })); return; } const stats = await pool.query("SELECT COUNT(*) as total, SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) as won, SUM(CASE WHEN status='lost' THEN 1 ELSE 0 END) as lost FROM estimates WHERE user_id=$1", [userId]); const s = stats.rows[0]; result = { total: parseInt(s?.total || "0"), won: parseInt(s?.won || "0"), lost: parseInt(s?.lost || "0"), winRate: parseInt(s?.total || "0") > 0 ? Math.round((parseInt(s?.won || "0") / (parseInt(s?.won || "0") + parseInt(s?.lost || "0") || 1)) * 100) : 0 }; break; }
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
