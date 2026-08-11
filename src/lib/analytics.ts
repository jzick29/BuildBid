import { makeAuthFn } from "./iso";
import crypto from "crypto";

/**
 * Fire-and-forget usage event tracking. Never throws and never blocks the
 * caller's response — failures are logged and swallowed so analytics can never
 * break a user action. Used from server handlers (vercel-entry + API routes).
 */
export async function trackEvent(
  pool: any,
  userId: string,
  eventType: string,
  eventData?: Record<string, unknown>
): Promise<void> {
  try {
    const id = crypto.randomUUID();
    await pool.query(
      "INSERT INTO analytics_events (id, user_id, event_type, event_data) VALUES ($1,$2,$3,$4)",
      [id, userId, eventType, eventData ? JSON.stringify(eventData) : "{}"]
    );
  } catch (e: any) {
    console.error("[analytics] trackEvent failed:", eventType, e?.message || e);
  }
}

export const getAnalytics = makeAuthFn("analytics.getAnalytics", async (_args, userId, pool) => {
  const stats = await pool.query("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won, SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost FROM estimates WHERE user_id = $1", [userId]);
  const s = stats.rows[0];
  const total = parseInt(s?.total || "0");
  const won = parseInt(s?.won || "0");
  const lost = parseInt(s?.lost || "0");
  const winRate = total > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const markupRow = await pool.query("SELECT ROUND(AVG(li.markup_percent)::numeric, 1) as avg_markup FROM line_items li JOIN estimates e ON e.id = li.estimate_id WHERE e.user_id = $1 AND e.status = 'won'", [userId]);
  const revenueRow = await pool.query("SELECT ROUND(SUM((SELECT SUM((li2.quantity * li2.unit_cost) * (1 + li2.markup_percent / 100.0)) FROM line_items li2 WHERE li2.estimate_id = e.id))::numeric, 2) as total_revenue FROM estimates e WHERE e.user_id = $1 AND e.status = 'won'", [userId]);
  const byTrade = await pool.query(`SELECT t.trade, COUNT(*) as count, SUM(CASE WHEN t.status = 'won' THEN 1 ELSE 0 END) as won_count, ROUND((100.0 * SUM(CASE WHEN t.status = 'won' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0))::numeric, 1) as win_rate, ROUND(AVG(t.est_markup_pct)::numeric, 1) as avg_markup, ROUND(AVG(t.est_grand_total)::numeric, 2) as avg_grand_total FROM (SELECT e.trade, e.status, (SELECT AVG(li2.markup_percent) FROM line_items li2 WHERE li2.estimate_id = e.id) AS est_markup_pct, (SELECT SUM((li2.quantity * li2.unit_cost) * (1 + li2.markup_percent / 100.0)) FROM line_items li2 WHERE li2.estimate_id = e.id) AS est_grand_total FROM estimates e WHERE e.user_id = $1 AND e.status IN ('won', 'lost')) t GROUP BY t.trade ORDER BY count DESC`, [userId]);
  const byMonth = await pool.query(`SELECT to_char(t.created_at, 'YYYY-MM') as month, COUNT(*) as count, SUM(CASE WHEN t.status = 'won' THEN 1 ELSE 0 END) as won_count, ROUND(SUM(CASE WHEN t.status = 'won' THEN t.est_grand_total ELSE 0 END)::numeric, 2) as total_revenue FROM (SELECT e.created_at, e.status, (SELECT SUM((li2.quantity * li2.unit_cost) * (1 + li2.markup_percent / 100.0)) FROM line_items li2 WHERE li2.estimate_id = e.id) AS est_grand_total FROM estimates e WHERE e.user_id = $1) t GROUP BY month ORDER BY month DESC LIMIT 12`, [userId]);
  const recentWins = await pool.query("SELECT e.id, e.project_name, e.customer_name, e.trade, e.created_at, ROUND((SELECT SUM((li2.quantity * li2.unit_cost) * (1 + li2.markup_percent / 100.0)) FROM line_items li2 WHERE li2.estimate_id = e.id)::numeric, 2) as grand_total FROM estimates e WHERE e.user_id = $1 AND e.status = 'won' ORDER BY e.created_at DESC LIMIT 5", [userId]);
  return {
    totalEstimates: total, wonCount: won, lostCount: lost, winRate,
    avgMarkup: parseFloat(markupRow.rows[0]?.avg_markup || "0"),
    totalRevenue: parseFloat(revenueRow.rows[0]?.total_revenue || "0"),
    byTrade: byTrade.rows, byMonth: byMonth.rows, recentWins: recentWins.rows,
  };
});
