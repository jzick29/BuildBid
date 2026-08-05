// GET /api/me — returns current user data with onboarding status
import { getCookie } from "@tanstack/react-start/server";
import { getPool } from "../../lib/pool";

export async function GET() {
  const pool = getPool();
  const token = getCookie("buildbid_session");
  if (!token) {
    return new Response(JSON.stringify({ user: null }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const r = await pool.query(
      `SELECT u.id, u.email, u.name, u.subscription_tier, u.trial_ends_at,
              u.stripe_customer_id, u.role, u.frozen,
              COALESCE(u.onboarding_completed, 0)::int AS onboarding_completed,
              COALESCE(u.trade, '') AS trade,
              COALESCE(u.phone, '') AS phone
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.expires_at > NOW()`,
      [token]
    );

    if (r.rows.length === 0) {
      return new Response(JSON.stringify({ user: null }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = r.rows[0];
    if (user.frozen) {
      return new Response(JSON.stringify({ user: null, error: "Account frozen" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ user: null, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
