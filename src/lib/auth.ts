import { createServerFn } from "@tanstack/react-start";
import { setCookie, getCookie, deleteCookie } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";

const SESSION_COOKIE = "buildbid_session";

// --- Inline SQLite helpers (server-only, never bundled for client) ---
// Using Bun's SQLite via dynamic import so Vite doesn't trace it at build time

async function getDb() {
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
  `);
  db.run("DELETE FROM sessions WHERE expires_at < datetime('now')");
  return db;
}

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Server function: signup
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
    const passwordHash = Bun.password.hashSync(data.password, { algorithm: "bcrypt", cost: 10 });
    db.run("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)", [id, data.email, data.name, passwordHash]);
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    db.run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [token, id, expiresAt]);
    setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return { success: true, user: { id, email: data.email, name: data.name } };
  });

// Server function: login
export const login = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { email?: string; password?: string };
    if (!d.email || !d.password) throw new Error("Email and password are required");
    return { email: d.email.trim().toLowerCase(), password: d.password };
  })
  .handler(async ({ data }) => {
    const db = await getDb();
    const row = db.query("SELECT id, email, name, password_hash FROM users WHERE email = ?").get(data.email) as any;
    if (!row) throw new Error("Invalid email or password");
    const valid = Bun.password.verifySync(data.password, row.password_hash);
    if (!valid) throw new Error("Invalid email or password");
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    db.run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [token, row.id, expiresAt]);
    setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return { success: true, user: { id: row.id, email: row.email, name: row.name } };
  });

// Server function: logout
export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    const db = await getDb();
    db.run("DELETE FROM sessions WHERE id = ?", [token]);
    deleteCookie(SESSION_COOKIE, { path: "/" });
  }
  return { success: true };
});

// Server function: get current user
export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return { user: null };
  const db = await getDb();
  const row = db.query(
    "SELECT u.id, u.email, u.name, u.plan FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > datetime('now')"
  ).get(token) as any;
  if (!row) {
    deleteCookie(SESSION_COOKIE, { path: "/" });
    return { user: null };
  }
  return { user: { id: row.id, email: row.email, name: row.name, plan: row.plan || "free" } };
});

// Server function: request password reset
export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { email?: string };
    if (!d.email) throw new Error("Email is required");
    return { email: d.email.trim().toLowerCase() };
  })
  .handler(async ({ data }) => {
    const db = await getDb();
    const user = db.query("SELECT id, email, name FROM users WHERE email = ?").get(data.email) as any;
    // Always return success to prevent email enumeration
    if (!user) return { success: true };
    // Delete any existing reset tokens for this user
    db.run("DELETE FROM reset_tokens WHERE user_id = ?", [user.id]);
    // Create new token (expires in 1 hour)
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.run("INSERT INTO reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
      [crypto.randomUUID(), user.id, token, expiresAt]);
    // Fire-and-forget the email (don't await — it's non-critical for the UX)
    const SITE_URL = process.env.SITE_URL || "https://9577f8f2426f13c1d9bbbec4a82baaa4.ctonew.app";
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

// Server function: validate reset token
export const validateResetToken = createServerFn({ method: "GET" })
  .validator((data: unknown) => {
    const d = data as { token?: string };
    if (!d.token) throw new Error("Token is required");
    return { token: d.token };
  })
  .handler(async ({ data }) => {
    const db = await getDb();
    const row = db.query(
      "SELECT user_id FROM reset_tokens WHERE token = ? AND expires_at > datetime('now')"
    ).get(data.token) as any;
    if (!row) return { valid: false };
    return { valid: true, userId: row.user_id };
  });

// Server function: reset password
export const resetPassword = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { token?: string; password?: string };
    if (!d.token) throw new Error("Token is required");
    if (!d.password || d.password.length < 6) throw new Error("Password must be at least 6 characters");
    return { token: d.token, password: d.password };
  })
  .handler(async ({ data }) => {
    const db = await getDb();
    const row = db.query(
      "SELECT user_id FROM reset_tokens WHERE token = ? AND expires_at > datetime('now')"
    ).get(data.token) as any;
    if (!row) throw new Error("Invalid or expired reset token");
    const passwordHash = Bun.password.hashSync(data.password, { algorithm: "bcrypt", cost: 10 });
    db.run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, row.user_id]);
    // Delete all reset tokens for this user
    db.run("DELETE FROM reset_tokens WHERE user_id = ?", [row.user_id]);
    // Delete all sessions for this user (force re-login)
    db.run("DELETE FROM sessions WHERE user_id = ?", [row.user_id]);
    return { success: true };
  });
