import { createIsomorphicFn } from "@tanstack/react-start";
import { registerHandler } from "./call-registry";
import { getPool } from "./pool";

// Registered handler for /api/call — uses passed token, no server imports
async function _handler(args: any, token?: string) {
  if (!token) return { tier: "trial", trialEndsAt: null };
  const pool = getPool();
  const result = await pool.query(
    "SELECT u.subscription_tier, u.trial_ends_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.expires_at > NOW()",
    [token]
  );
  const row = result.rows[0];
  if (!row) return { tier: "trial", trialEndsAt: null };
  return { tier: row.subscription_tier || "trial", trialEndsAt: row.trial_ends_at || null };
}
registerHandler("subscriptions.getSubscription", _handler);

export const getSubscription = createIsomorphicFn()
  .client(async () => {
    const res = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "subscriptions.getSubscription", args: {} }), credentials: "include" });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
    return res.json();
  })
  .server(async () => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie("buildbid_session");
    if (!token) return { tier: "trial", trialEndsAt: null };
    const pool = getPool();
    const result = await pool.query(
      "SELECT u.subscription_tier, u.trial_ends_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.expires_at > NOW()",
      [token]
    );
    const row = result.rows[0];
    if (!row) return { tier: "trial", trialEndsAt: null };
    return { tier: row.subscription_tier || "trial", trialEndsAt: row.trial_ends_at || null };
  });

export function useSubscription() {
  return { tier: "trial", trialEndsAt: null as string | null };
}
