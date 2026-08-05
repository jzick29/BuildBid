import { makeAuthFn } from "./iso";

export const getAnalytics = makeAuthFn("analytics.getAnalytics", async (_args, userId, pool) => {
  const stats = await pool.query("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won, SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost FROM estimates WHERE user_id = $1", [userId]);
  const s = stats.rows[0];
  const total = parseInt(s?.total || "0");
  const won = parseInt(s?.won || "0");
  const lost = parseInt(s?.lost || "0");
  const winRate = total > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const markupRow = await pool.query("SELECT ROUND(AVG(li.markup_percent), 1) as avg_markup FROM line_items li JOIN estimates e ON e.id = li.estimate_id WHERE e.user_id = $1 AND e.status = 'won'", [userId]);
  const revenueRow = await pool.query("SELECT ROUND(SUM((SELECT SUM((li2.quantity * li2.unit_cost) * (1 + li2.markup_percent / 100.0)) FROM line_items li2 WHERE li2.estimate_id = e.id)), 2) as total_revenue FROM estimates e WHERE e.user_id = $1 AND e.status = 'won'", [userId]);
  const byTrade = await pool.query("SELECT e.trade, COUNT(*) as count, SUM(CASE WHEN e.status = 'won' THEN 1 ELSE 0 END) as won_count, ROUND(100.0 * SUM(CASE WHEN e.status = 'won' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as win_rate, ROUND(AVG((SELECT AVG(li2.markup_percent) FROM line_items li2 WHERE li2.estimate_id = e.id)), 1) as avg_markup, ROUND(AVG((SELECT SUM((li2.quantity * li2.unit_cost) * (1 + li2.markup_percent / 100.0)) FROM line_items li2 WHERE li2.estimate_id = e.id)), 2) as avg_grand_total FROM estimates e WHERE e.user_id = $1 AND e.status IN ('won', 'lost') GROUP BY e.trade ORDER BY count DESC", [userId]);
  const byMonth = await pool.query("SELECT to_char(e.created_at, 'YYYY-MM') as month, COUNT(*) as count, SUM(CASE WHEN e.status = 'won' THEN 1 ELSE 0 END) as won_count, ROUND(SUM(CASE WHEN e.status = 'won' THEN (SELECT SUM((li2.quantity * li2.unit_cost) * (1 + li2.markup_percent / 100.0)) FROM line_items li2 WHERE li2.estimate_id = e.id) ELSE 0 END), 2) as total_revenue FROM estimates e WHERE e.user_id = $1 GROUP BY month ORDER BY month DESC LIMIT 12", [userId]);
  const recentWins = await pool.query("SELECT e.id, e.project_name, e.customer_name, e.trade, e.created_at, ROUND((SELECT SUM((li2.quantity * li2.unit_cost) * (1 + li2.markup_percent / 100.0)) FROM line_items li2 WHERE li2.estimate_id = e.id), 2) as grand_total FROM estimates e WHERE e.user_id = $1 AND e.status = 'won' ORDER BY e.created_at DESC LIMIT 5", [userId]);
  return {
    totalEstimates: total, wonCount: won, lostCount: lost, winRate,
    avgMarkup: parseFloat(markupRow.rows[0]?.avg_markup || "0"),
    totalRevenue: parseFloat(revenueRow.rows[0]?.total_revenue || "0"),
    byTrade: byTrade.rows, byMonth: byMonth.rows, recentWins: recentWins.rows,
  };
});
