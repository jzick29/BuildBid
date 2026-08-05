import { makeAuthFn } from "./iso";

/** Calculate profit margin for single estimate */
export const getMargin = makeAuthFn("profitMargin.getMargin", async (args: { data: { id: string } }, userId: string, pool: any) => {
  const est = await pool.query("SELECT id FROM estimates WHERE id = $1 AND user_id = $2", [args.data.id, userId]);
  if (!est.rows[0]) throw new Error("Estimate not found");

  const r = await pool.query(
    `SELECT COALESCE(SUM(li.quantity * li.unit_cost), 0) as total_cost,
            COALESCE(SUM(li.quantity * li.unit_cost * (1 + li.markup_percent / 100)), 0) as total_revenue
     FROM line_items li WHERE li.estimate_id = $1`, [args.data.id]);

  const cost = parseFloat(r.rows[0].total_cost);
  const revenue = parseFloat(r.rows[0].total_revenue);
  const profit = revenue - cost;
  const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;
  const threshR = await pool.query("SELECT margin_threshold FROM users WHERE id = $1", [userId]);
  const threshold = threshR.rows[0]?.margin_threshold ?? 20;

  return { cost, revenue, profit, marginPercent: Math.round(marginPercent * 10) / 10, threshold,
    isLow: marginPercent < threshold,
    warning: marginPercent < threshold ? (marginPercent < threshold / 2 ? "critical" : "warning") : "ok" };
});

/** Batch-check margins for active estimates */
export const checkAllMargins = makeAuthFn("profitMargin.checkAllMargins", async (_args: any, userId: string, pool: any) => {
  const threshR = await pool.query("SELECT margin_threshold FROM users WHERE id = $1", [userId]);
  const threshold = threshR.rows[0]?.margin_threshold ?? 20;

  const r = await pool.query(
    `SELECT e.id, e.project_name, e.customer_name, e.status,
       COALESCE(SUM(li.quantity * li.unit_cost), 0) as total_cost,
       COALESCE(SUM(li.quantity * li.unit_cost * (1 + li.markup_percent / 100)), 0) as total_revenue
     FROM estimates e LEFT JOIN line_items li ON li.estimate_id = e.id
     WHERE e.user_id = $1 AND e.status IN ('draft','sent')
     GROUP BY e.id ORDER BY total_cost DESC`, [userId]);

  const items = r.rows.map((row: any) => {
    const cost = parseFloat(row.total_cost), revenue = parseFloat(row.total_revenue);
    const profit = revenue - cost;
    const mp = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;
    return { id: row.id, projectName: row.project_name, customerName: row.customer_name,
      status: row.status, cost, revenue, profit, marginPercent: mp, threshold,
      isLow: mp < threshold, warning: mp < threshold ? (mp < threshold / 2 ? "critical" : "warning") : "ok" };
  });
  return { items, threshold, lowCount: items.filter((i: any) => i.isLow).length };
});

/** Set user margin threshold */
export const setMarginThreshold = makeAuthFn("profitMargin.setMarginThreshold", async (args: { data: { threshold: number } }, userId: string, pool: any) => {
  if (args.data.threshold < 0 || args.data.threshold > 100) throw new Error("Threshold must be 0-100");
  await pool.query("UPDATE users SET margin_threshold = $1 WHERE id = $2", [args.data.threshold, userId]);
  return { success: true, threshold: args.data.threshold };
});
