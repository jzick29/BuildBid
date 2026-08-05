// POST /api/onboarding — saves onboarding data and marks onboarding as complete
import { getPool } from "../../lib/pool";

export async function POST({ request }: { request: Request }) {
  const pool = getPool();
  const cookieHeader = request.headers.get("cookie") || "";
  const sessionMatch = cookieHeader.match(/buildbid_session=([^;]+)/);
  if (!sessionMatch) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const sessionRes = await pool.query("SELECT user_id FROM sessions WHERE id = $1 AND expires_at > NOW()", [sessionMatch[1]]);
  if (sessionRes.rows.length === 0) {
    return new Response(JSON.stringify({ success: false, error: "Session expired" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const userId = sessionRes.rows[0].user_id;

  try {
    const body = await request.json();
    const { trade, phone, company_name } = body;

    if (!trade) {
      return new Response(JSON.stringify({ success: false, error: "Trade is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await pool.query(
      "UPDATE users SET trade = $1, phone = $2, name = COALESCE(NULLIF($3, ''), name), onboarding_completed = 1 WHERE id = $4",
      [trade, phone || "", company_name || "", userId]
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
