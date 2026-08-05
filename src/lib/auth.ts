import { createServerFn } from "@tanstack/react-start";
import { setCookie, getCookie, deleteCookie } from "@tanstack/react-start/server";
import bcrypt from "bcryptjs";

const SESSION_COOKIE = "buildbid_session";
const isVercel = typeof process !== 'undefined' && !!process.env.VERCEL;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// --- Database abstraction layer ---
// On Vercel: uses Neon Postgres via the global pool set up in vercel-entry.ts
// Locally: uses Bun's SQLite

type DbRow = Record<string, any>;

interface DbAdapter {
  queryOne(sql: string, params?: any[]): Promise<DbRow | null>;
  queryAll(sql: string, params?: any[]): Promise<DbRow[]>;
  execute(sql: string, params?: any[]): Promise<void>;
  ensureSchema(): Promise<void>;
}

let _adapter: DbAdapter | null = null;

async function getNeonAdapter(): Promise<DbAdapter> {
  const pool = (globalThis as any).__buildbid_pool;
  if (!pool) throw new Error("Neon pool not initialized");

  return {
    async queryOne(sql, params = []) {
      // Convert ? placeholders to $1, $2, ...
      let idx = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
      const result = await pool.query(pgSql, params);
      return result.rows[0] || null;
    },
    async queryAll(sql, params = []) {
      let idx = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
      const result = await pool.query(pgSql, params);
      return result.rows;
    },
    async execute(sql, params = []) {
      let idx = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
      await pool.query(pgSql, params);
    },
    async ensureSchema() {
      await pool.query(`
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
          created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
        );
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
        );
        CREATE TABLE IF NOT EXISTS reset_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      `);
    },
  };
}

async function getBunAdapter(): Promise<DbAdapter> {
  let Database: any;
  try {
    Database = (await import("bun:sqlite")).Database;
  } catch {
    throw new Error("bun:sqlite not available");
  }
  const { existsSync, mkdirSync } = await import("fs");
  const dir = '/tmp/buildbid-data';
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const db = new Database(`${dir}/app.db`);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  return {
    async queryOne(sql, params = []) {
      const stmt = db.prepare(sql);
      return stmt.get(...params) || null;
    },
    async queryAll(sql, params = []) {
      const stmt = db.prepare(sql);
      return stmt.all(...params);
    },
    async execute(sql, params = []) {
      db.run(sql, ...params);
    },
    async ensureSchema() {
      // Add subscription columns if missing (migration)
      try { db.exec("ALTER TABLE users ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'trial'"); } catch (_) {}
      try { db.exec("ALTER TABLE users ADD COLUMN trial_ends_at TEXT"); } catch (_) {}
      try { db.exec("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT"); } catch (_) {}
      try { db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'"); } catch (_) {}
      try { db.exec("ALTER TABLE users ADD COLUMN frozen INTEGER NOT NULL DEFAULT 0"); } catch (_) {}
      db.exec(`
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
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS reset_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      `);
    },
  };
}

async function getDb(): Promise<DbAdapter> {
  if (_adapter) return _adapter;
  if (isVercel) {
    _adapter = await getNeonAdapter();
  } else {
    _adapter = await getBunAdapter();
  }
  await _adapter.ensureSchema();
  // Clean expired sessions (CURRENT_TIMESTAMP works in both SQLite and PostgreSQL)
  await _adapter.execute("DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP");
  return _adapter;
}

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

// --- Auth functions ---

export const signup = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { email?: string; password?: string; name?: string };
    if (!d.email || !d.password) throw new Error("Email and password are required");
    if (d.password.length < 6) throw new Error("Password must be at least 6 characters");
    return { email: d.email.trim().toLowerCase(), password: d.password, name: d.name?.trim() || d.email.split("@")[0] };
  })
  .handler(async ({ data }) => {
    const db = await getDb();
    const id = crypto.randomUUID();
    const passwordHash = hashPassword(data.password);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const users = await db.queryAll("SELECT COUNT(*) as c FROM users");
    const userCount = users[0]?.c || 0;
    const isFirstUser = userCount === 0;
    const role = (isFirstUser && !adminEmail) || data.email === adminEmail ? "admin" : "user";
    await db.execute(
      "INSERT INTO users (id, email, name, password_hash, subscription_tier, trial_ends_at, role) VALUES (?, ?, ?, ?, 'trial', ?, ?)",
      [id, data.email, data.name, passwordHash, trialEndsAt, role]
    );
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    await db.execute("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [token, id, expiresAt]);
    setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return { success: true, user: { id, email: data.email, name: data.name } };
  });

export const login = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { email?: string; password?: string };
    if (!d.email || !d.password) throw new Error("Email and password are required");
    return { email: d.email.trim().toLowerCase(), password: d.password };
  })
  .handler(async ({ data }) => {
    const db = await getDb();
    const row = await db.queryOne("SELECT id, email, name, password_hash, frozen FROM users WHERE email = ?", [data.email]);
    if (!row) throw new Error("Invalid email or password");
    if (row.frozen === 1 || row.frozen === true) throw new Error("This account has been suspended. Contact support.");
    const valid = verifyPassword(data.password, row.password_hash);
    if (!valid) throw new Error("Invalid email or password");
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    await db.execute("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [token, row.id, expiresAt]);
    setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return { success: true, user: { id: row.id, email: row.email, name: row.name } };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    const db = await getDb();
    await db.execute("DELETE FROM sessions WHERE id = ?", [token]);
    deleteCookie(SESSION_COOKIE, { path: "/" });
  }
  return { success: true };
});

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return { user: null };
  const db = await getDb();
  const row = await db.queryOne(
    "SELECT u.id, u.email, u.name, u.subscription_tier, u.trial_ends_at, u.stripe_customer_id, u.role, u.frozen, COALESCE(u.onboarding_completed, 0) AS onboarding_completed, COALESCE(u.trade, '') AS trade, COALESCE(u.phone, '') AS phone FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP",
    [token]
  );
  if (!row) {
    deleteCookie(SESSION_COOKIE, { path: "/" });
    return { user: null };
  }
  if (row.frozen === 1 || row.frozen === true) {
    deleteCookie(SESSION_COOKIE, { path: "/" });
    return { user: null };
  }
  return {
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      subscriptionTier: row.subscription_tier || "trial",
      trialEndsAt: row.trial_ends_at,
      stripeCustomerId: row.stripe_customer_id,
      role: row.role || "user",
      isAdmin: row.role === "admin",
    }
  };
});

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { email?: string };
    if (!d.email) throw new Error("Email is required");
    return { email: d.email.trim().toLowerCase() };
  })
  .handler(async ({ data }) => {
    const db = await getDb();
    const user = await db.queryOne("SELECT id, email, name FROM users WHERE email = ?", [data.email]);
    if (!user) return { success: true };
    await db.execute("DELETE FROM reset_tokens WHERE user_id = ?", [user.id]);
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.execute("INSERT INTO reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
      [crypto.randomUUID(), user.id, token, expiresAt]);
    const SITE_URL = process.env.SITE_URL || "https://buildbid.pro";
    const resetLink = `${SITE_URL}/reset-password?token=${token}`;
    try {
      await fetch(`${SITE_URL}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: user.email,
          subject: "Reset your BuildBid password",
          body: `Hi ${user.name || "there"},\n\nWe received a request to reset your BuildBid password.\n\nClick the link below to set a new password:\n${resetLink}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.\n\n— The BuildBid Team`,
        }),
      });
    } catch (e) {
      console.error("Failed to queue password reset email:", e);
    }
    return { success: true };
  });

export const validateResetToken = createServerFn({ method: "GET" })
  .validator((data: unknown) => {
    const d = data as { token?: string };
    if (!d.token) throw new Error("Token is required");
    return { token: d.token };
  })
  .handler(async ({ data }) => {
    const db = await getDb();
    const row = await db.queryOne(
      "SELECT user_id FROM reset_tokens WHERE token = ? AND expires_at > CURRENT_TIMESTAMP",
      [data.token]
    );
    if (!row) return { valid: false };
    return { valid: true, userId: row.user_id };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { token?: string; password?: string };
    if (!d.token) throw new Error("Token is required");
    if (!d.password || d.password.length < 6) throw new Error("Password must be at least 6 characters");
    return { token: d.token, password: d.password };
  })
  .handler(async ({ data }) => {
    const db = await getDb();
    const row = await db.queryOne(
      "SELECT user_id FROM reset_tokens WHERE token = ? AND expires_at > CURRENT_TIMESTAMP",
      [data.token]
    );
    if (!row) throw new Error("Invalid or expired reset token");
    const passwordHash = hashPassword(data.password);
    await db.execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, row.user_id]);
    await db.execute("DELETE FROM reset_tokens WHERE user_id = ?", [row.user_id]);
    await db.execute("DELETE FROM sessions WHERE user_id = ?", [row.user_id]);
    return { success: true };
  });

export const upgradeSubscription = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { tier?: string };
    if (!d.tier || !["starter", "pro", "shop"].includes(d.tier)) throw new Error("Invalid tier");
    return d as { tier: string };
  })
  .handler(async ({ data }) => {
    const token = getCookie(SESSION_COOKIE);
    if (!token) throw new Error("Not authenticated");
    const db = await getDb();
    const session = await db.queryOne("SELECT user_id FROM sessions WHERE id = ? AND expires_at > CURRENT_TIMESTAMP", [token]);
    if (!session) throw new Error("Session expired");
    await db.execute("UPDATE users SET subscription_tier = ? WHERE id = ?", [data.tier, session.user_id]);
    return { success: true, tier: data.tier };
  });
