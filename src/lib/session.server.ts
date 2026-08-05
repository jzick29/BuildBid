// Session auth helper — safe for client-side imports.
// Uses dynamic import for server-only modules so TanStack Start
// doesn't block it during client build.
import { getPool } from "./pool";

const SESSION_COOKIE = "buildbid_session";

export interface AuthUser {
  id: string; email: string; name: string;
  subscriptionTier: string; trialEndsAt: string | null;
  stripeCustomerId: string | null; role: string; frozen: number;
}

export async function requireUser(): Promise<AuthUser> {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(SESSION_COOKIE);
  if (!token) throw new Error("Not authenticated");
  const pool = getPool();
  const result = await pool.query(
    `SELECT u.id, u.email, u.name, u.subscription_tier, u.trial_ends_at,
            u.stripe_customer_id, u.role, u.frozen
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [token]
  );
  const row = result.rows[0];
  if (!row) throw new Error("Not authenticated");
  if (row.frozen === 1) throw new Error("Account suspended");
  return {
    id: row.id, email: row.email, name: row.name,
    subscriptionTier: row.subscription_tier || "trial",
    trialEndsAt: row.trial_ends_at,
    stripeCustomerId: row.stripe_customer_id,
    role: row.role || "user",
    frozen: row.frozen,
  };
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Admin required");
  return user;
}

export async function getUserFromToken(token: string): Promise<AuthUser | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT u.id, u.email, u.name, u.subscription_tier, u.trial_ends_at,
            u.stripe_customer_id, u.role, u.frozen
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [token]
  );
  const row = result.rows[0];
  if (!row || row.frozen === 1) return null;
  return {
    id: row.id, email: row.email, name: row.name,
    subscriptionTier: row.subscription_tier || "trial",
    trialEndsAt: row.trial_ends_at,
    stripeCustomerId: row.stripe_customer_id,
    role: row.role || "user",
    frozen: row.frozen,
  };
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {};
  cookieHeader.split(";").forEach(c => {
    const [key, ...rest] = c.trim().split("=");
    if (key) result[key] = rest.join("=");
  });
  return result;
}

export function getSessionToken(req: Request): string | undefined {
  const cookie = req.headers.get("cookie") || "";
  return parseCookies(cookie)[SESSION_COOKIE];
}
