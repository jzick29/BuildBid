// Safe isomorphic function helpers — no server imports at module scope.
// Uses token parameter for registered handlers and getCookie inside .server().
import { createIsomorphicFn } from "@tanstack/react-start";
import { registerHandler } from "./call-registry";
import { getPool } from "./pool";

type BusinessHandler = (args: any, userId: string, pool: any) => Promise<any>;

/** Create an isomorphic fn that requires auth. The business handler receives (args, userId, pool). */
export function makeAuthFn(name: string, handler: BusinessHandler) {
  // Registered handler for /api/call — uses token from dispatcher
  const _h = async (args: any, token?: string): Promise<any> => {
    if (!token) throw new Error("Not authenticated");
    const pool = getPool();
    const r = await pool.query(
      "SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.expires_at > NOW()",
      [token]
    );
    if (!r.rows[0]) throw new Error("Not authenticated");
    return handler(args, r.rows[0].id, pool);
  };
  registerHandler(name, _h);

  return createIsomorphicFn()
    .client(async (args?: any) => {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: name, args: args || {} }),
        credentials: "include",
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      return res.json();
    })
    .server(async (args?: any) => {
      const { getCookie } = await import("@tanstack/react-start/server");
      const token = getCookie("buildbid_session");
      if (!token) throw new Error("Not authenticated");
      const pool = getPool();
      const r = await pool.query(
        "SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.expires_at > NOW()",
        [token]
      );
      if (!r.rows[0]) throw new Error("Not authenticated");
      return handler(args, r.rows[0].id, pool);
    });
}

/** Create an isomorphic fn with full user returned to handler. */
export function makeAuthFnFull(name: string, handler: (args: any, user: any, pool: any) => Promise<any>) {
  const _h = async (args: any, token?: string): Promise<any> => {
    if (!token) throw new Error("Not authenticated");
    const pool = getPool();
    const r = await pool.query(
      "SELECT u.id, u.email, u.name, u.subscription_tier, u.stripe_customer_id, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.expires_at > NOW()",
      [token]
    );
    if (!r.rows[0]) throw new Error("Not authenticated");
    return handler(args, r.rows[0], pool);
  };
  registerHandler(name, _h);

  return createIsomorphicFn()
    .client(async (args?: any) => {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: name, args: args || {} }),
        credentials: "include",
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      return res.json();
    })
    .server(async (args?: any) => {
      const { getCookie } = await import("@tanstack/react-start/server");
      const token = getCookie("buildbid_session");
      if (!token) throw new Error("Not authenticated");
      const pool = getPool();
      const r = await pool.query(
        "SELECT u.id, u.email, u.name, u.subscription_tier, u.stripe_customer_id, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.expires_at > NOW()",
        [token]
      );
      if (!r.rows[0]) throw new Error("Not authenticated");
      return handler(args, r.rows[0], pool);
    });
}

// Backward-compat alias for existing files that haven't been migrated yet
export const defineFn = makeAuthFn;

/** Create a public (no auth) isomorphic fn. */
export function makePublicFn(name: string, handler: (args: any, pool: any) => Promise<any>) {
  const _h = async (args: any, _token?: string): Promise<any> => {
    const pool = getPool();
    return handler(args, pool);
  };
  registerHandler(name, _h);

  return createIsomorphicFn()
    .client(async (args?: any) => {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: name, args: args || {} }),
        credentials: "omit",
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      return res.json();
    })
    .server(async (args?: any) => {
      const pool = getPool();
      return handler(args, pool);
    });
}
