// Reports library — job profitability, win/loss, estimator performance, revenue trends, cost breakdown.
// Registered as makeAuthFn handlers so they work in dev (registry) and prod (vercel-entry switch).
import { makeAuthFn } from "./iso";
import type { Pool } from "@neondatabase/serverless";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Grand total (before tax) of an estimate: Σ(qty × unit_cost × (1+markup)) */
const REVENUE_SQL = `(SELECT COALESCE(SUM((li.quantity * li.unit_cost) * (1 + li.markup_percent / 100.0)), 0) FROM line_items li WHERE li.estimate_id = e.id)`;
/** Direct estimated cost of an estimate: Σ(qty × unit_cost) */
const COST_SQL = `(SELECT COALESCE(SUM(li.quantity * li.unit_cost), 0) FROM line_items li WHERE li.estimate_id = e.id)`;

function num(v: any): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/**
 * Build a parameterized WHERE clause scoped to the current user.
 * Supports: range (30/90/365/all), from/to (YYYY-MM-DD), trade, estimatorId
 * (must be self or a team member of self).
 */
async function buildScope(pool: Pool, userId: string, data: any) {
  const params: any[] = [userId];
  const conds = ["e.user_id = $1"];

  let from: string | null = null;
  let to: string | null = null;
  if (data?.from && data?.to) {
    from = data.from;
    to = data.to;
  } else if (data?.range && data.range !== "all") {
    const days = parseInt(data.range, 10) || 365;
    from = new Date(Date.now() - days * 86400000).toISOString();
  }
  if (from) { params.push(from); conds.push(`e.created_at >= $${params.length}`); }
  if (to) { params.push(`${to}T23:59:59.999Z`); conds.push(`e.created_at <= $${params.length}`); }

  if (data?.trade) {
    params.push(data.trade);
    conds.push(`e.trade = $${params.length}`);
  }
  if (data?.estimatorId) {
    const ok =
      data.estimatorId === userId ||
      (await pool.query("SELECT 1 FROM team_members WHERE owner_id = $1 AND user_id = $2", [userId, data.estimatorId])).rows.length > 0;
    if (ok) {
      params.push(data.estimatorId);
      conds.push(`e.user_id = $${params.length}`);
    }
  }
  return { where: "WHERE " + conds.join(" AND "), params };
}

// ---------------------------------------------------------------------------
// reports.filters — trades + estimators for dropdowns
// ---------------------------------------------------------------------------
export const getReportFilters = makeAuthFn("reports.filters", async (args, userId, pool) => {
  const trades = (await pool.query("SELECT DISTINCT trade FROM estimates WHERE user_id = $1 AND trade <> '' ORDER BY trade", [userId])).rows.map((r: any) => r.trade);
  const estimators = (await pool.query(
    `SELECT u.id, u.name, u.email FROM users u
     WHERE u.id = $1 OR u.id IN (SELECT user_id FROM team_members WHERE owner_id = $1)
     ORDER BY u.name`, [userId])).rows;
  return { trades, estimators };
});

// ---------------------------------------------------------------------------
// reports.profitability — per-job actual vs estimated, margins
// ---------------------------------------------------------------------------
export const getProfitability = makeAuthFn("reports.profitability", async (args, userId, pool) => {
  const { where, params } = await buildScope(pool, userId, args?.data || {});
  const rows = (await pool.query(
    `SELECT e.id, e.project_name, e.customer_name, e.trade, e.status, e.created_at,
       ${COST_SQL} AS est_cost,
       ${REVENUE_SQL} AS est_revenue,
       (e.actual_material_cost + e.actual_labor_cost + e.actual_other_cost) AS actual_cost,
       e.actual_material_cost, e.actual_labor_cost, e.actual_other_cost
     FROM estimates e ${where} ORDER BY e.created_at DESC LIMIT 300`, params)).rows;

  const jobs = rows.map((r: any) => {
    const estCost = num(r.est_cost);
    const estRevenue = num(r.est_revenue);
    const actualCost = num(r.actual_cost);
    const estMargin = estRevenue - estCost;
    const estMarginPct = estRevenue > 0 ? (estMargin / estRevenue) * 100 : 0;
    const actualMargin = actualCost > 0 ? estRevenue - actualCost : null;
    const actualMarginPct = actualMargin != null && estRevenue > 0 ? (actualMargin / estRevenue) * 100 : null;
    return {
      id: r.id, projectName: r.project_name, customerName: r.customer_name, trade: r.trade,
      status: r.status, createdAt: r.created_at,
      estCost: round2(estCost), estRevenue: round2(estRevenue), estMargin: round2(estMargin),
      estMarginPct: round1(estMarginPct),
      actualCost: round2(actualCost), actualMargin: actualMargin == null ? null : round2(actualMargin),
      actualMarginPct: actualMarginPct == null ? null : round1(actualMarginPct),
    };
  });

  // Summary: average margin + most profitable trade
  const decided = jobs.filter((j: any) => j.status === "won" || j.status === "lost");
  const withMargin = decided.filter((j: any) => j.estRevenue > 0);
  const avgMarginPct = withMargin.length ? withMargin.reduce((s: number, j: any) => s + j.estMarginPct, 0) / withMargin.length : 0;
  const byTrade: Record<string, { revenue: number; margin: number }> = {};
  for (const j of withMargin) {
    byTrade[j.trade] = byTrade[j.trade] || { revenue: 0, margin: 0 };
    byTrade[j.trade].revenue += j.estRevenue;
    byTrade[j.trade].margin += j.estMargin;
  }
  let bestTrade: any = null;
  for (const [trade, v] of Object.entries(byTrade)) {
    const pct = v.revenue > 0 ? (v.margin / v.revenue) * 100 : 0;
    if (!bestTrade || pct > bestTrade.marginPct) bestTrade = { trade, marginPct: round1(pct), revenue: round2(v.revenue) };
  }
  return {
    jobs,
    summary: {
      totalEstimatedRevenue: round2(jobs.reduce((s: number, j: any) => s + j.estRevenue, 0)),
      totalEstimatedCost: round2(jobs.reduce((s: number, j: any) => s + j.estCost, 0)),
      avgMarginPct: round1(avgMarginPct),
      bestTrade,
      jobsWithActuals: jobs.filter((j: any) => j.actualCost > 0).length,
    },
  };
});

// ---------------------------------------------------------------------------
// reports.winLoss — win rate by trade, by month, by job size
// ---------------------------------------------------------------------------
export const getWinLoss = makeAuthFn("reports.winLoss", async (args, userId, pool) => {
  const { where, params } = await buildScope(pool, userId, args?.data || {});
  const decided = where.replace(/^WHERE /, "WHERE ") + (where === "WHERE e.user_id = $1" && !args?.data?.trade && !args?.data?.estimatorId ? "" : "") + " AND e.status IN ('won','lost')";
  const byTrade = (await pool.query(
    `SELECT e.trade, COUNT(*) AS total,
       SUM(CASE WHEN e.status = 'won' THEN 1 ELSE 0 END) AS won,
       SUM(CASE WHEN e.status = 'lost' THEN 1 ELSE 0 END) AS lost
     FROM estimates e ${decided} GROUP BY e.trade ORDER BY total DESC`, params)).rows.map((r: any) => ({
    trade: r.trade, total: parseInt(r.total), won: parseInt(r.won), lost: parseInt(r.lost),
    winRate: round1((num(r.total) ? (num(r.won) / num(r.total)) * 100 : 0)),
  }));

  const byMonth = (await pool.query(
    `SELECT to_char(e.created_at, 'YYYY-MM') AS month,
       COUNT(*) AS total,
       SUM(CASE WHEN e.status = 'won' THEN 1 ELSE 0 END) AS won,
       SUM(CASE WHEN e.status = 'lost' THEN 1 ELSE 0 END) AS lost,
       COALESCE(SUM(CASE WHEN e.status = 'won' THEN ${REVENUE_SQL} ELSE 0 END), 0) AS revenue
     FROM estimates e ${decided} GROUP BY month ORDER BY month`, params)).rows.map((r: any) => ({
    month: r.month, total: parseInt(r.total), won: parseInt(r.won), lost: parseInt(r.lost),
    winRate: round1((num(r.total) ? (num(r.won) / num(r.total)) * 100 : 0)), revenue: round2(num(r.revenue)),
  }));

  const bySize = (await pool.query(
    `SELECT
       CASE
         WHEN ${REVENUE_SQL} < 5000 THEN 'Under $5k'
         WHEN ${REVENUE_SQL} < 10000 THEN '$5k–$10k'
         WHEN ${REVENUE_SQL} < 25000 THEN '$10k–$25k'
         WHEN ${REVENUE_SQL} < 50000 THEN '$25k–$50k'
         WHEN ${REVENUE_SQL} < 100000 THEN '$50k–$100k'
         ELSE '$100k+'
       END AS bucket,
       COUNT(*) AS total,
       SUM(CASE WHEN e.status = 'won' THEN 1 ELSE 0 END) AS won,
       SUM(CASE WHEN e.status = 'lost' THEN 1 ELSE 0 END) AS lost
     FROM estimates e ${decided} GROUP BY bucket ORDER BY MIN(${REVENUE_SQL})`, params)).rows.map((r: any) => ({
    bucket: r.bucket, total: parseInt(r.total), won: parseInt(r.won), lost: parseInt(r.lost),
    winRate: round1((num(r.total) ? (num(r.won) / num(r.total)) * 100 : 0)),
  }));

  const totals = byTrade.reduce((s: any, r: any) => ({ total: s.total + r.total, won: s.won + r.won, lost: s.lost + r.lost }), { total: 0, won: 0, lost: 0 });
  return {
    byTrade, byMonth, bySize,
    summary: { total: totals.total, won: totals.won, lost: totals.lost, winRate: round1(totals.total ? (totals.won / totals.total) * 100 : 0) },
  };
});

// ---------------------------------------------------------------------------
// reports.estimatorPerformance — per-estimator metrics
// ---------------------------------------------------------------------------
export const getEstimatorPerformance = makeAuthFn("reports.estimatorPerformance", async (args, userId, pool) => {
  const { where, params } = await buildScope(pool, userId, args?.data || {});
  const rows = (await pool.query(
    `SELECT e.user_id AS estimator_id, COALESCE(u.name, u.email) AS name, u.email,
       COUNT(*) AS estimates,
       SUM(CASE WHEN e.status = 'won' THEN 1 ELSE 0 END) AS won,
       SUM(CASE WHEN e.status = 'lost' THEN 1 ELSE 0 END) AS lost,
       COALESCE(AVG(CASE WHEN e.status IN ('won','lost') THEN ${REVENUE_SQL} END), 0) AS avg_bid,
       COALESCE(SUM(CASE WHEN e.status = 'won' THEN ${REVENUE_SQL} ELSE 0 END), 0) AS total_revenue,
       COALESCE(AVG(CASE WHEN e.status = 'won' THEN EXTRACT(EPOCH FROM (COALESCE(e.signed_at, e.updated_at) - e.created_at)) / 86400.0 END), 0) AS avg_turnover_days
     FROM estimates e LEFT JOIN users u ON u.id = e.user_id
     ${where} GROUP BY e.user_id, u.name, u.email ORDER BY estimates DESC`, params)).rows.map((r: any) => ({
    estimatorId: r.estimator_id, name: r.name, email: r.email,
    estimates: parseInt(r.estimates), won: parseInt(r.won), lost: parseInt(r.lost),
    winRate: round1((num(r.estimates) ? (num(r.won) / num(r.estimates)) * 100 : 0)),
    avgBid: round2(num(r.avg_bid)), totalRevenue: round2(num(r.total_revenue)),
    avgTurnoverDays: round1(num(r.avg_turnover_days)),
  }));
  return { estimators: rows };
});

// ---------------------------------------------------------------------------
// reports.revenueTrends — monthly revenue, YoY, projection
// ---------------------------------------------------------------------------
export const getRevenueTrends = makeAuthFn("reports.revenueTrends", async (args, userId, pool) => {
  const data = args?.data || {};
  const months = parseInt(data?.months || "12", 10) || 12;
  const { where, params } = await buildScope(pool, userId, data);

  // Only won estimates count as revenue
  const wonWhere = where + " AND e.status = 'won'";
  const rows = (await pool.query(
    `SELECT to_char(e.created_at, 'YYYY-MM') AS month,
       COALESCE(SUM(${REVENUE_SQL}), 0) AS revenue
     FROM estimates e ${wonWhere} GROUP BY month`, params)).rows;

  const byMonth: Record<string, number> = {};
  for (const r of rows) byMonth[r.month] = num(r.revenue);

  // Build month series (last N months) + YoY comparison
  const now = new Date();
  const series: any[] = [];
  let ytd = 0;
  const currentYear = now.getFullYear();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const prevKey = `${d.getFullYear() - 1}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const revenue = byMonth[key] || 0;
    const prevYear = byMonth[prevKey] || 0;
    if (d.getFullYear() === currentYear) ytd += revenue;
    series.push({
      month: key,
      label: d.toLocaleString("en-US", { month: "short" }) + (d.getFullYear() !== currentYear ? ` ${String(d.getFullYear()).slice(2)}` : ""),
      revenue: round2(revenue),
      prevYear: round2(prevYear),
      yoyPct: prevYear > 0 ? round1(((revenue - prevYear) / prevYear) * 100) : null,
    });
  }

  // Projection: current-year run-rate (YTD / elapsed months × 12)
  const elapsedMonths = now.getMonth() + 1;
  const projection = elapsedMonths > 0 ? (ytd / elapsedMonths) * 12 : 0;

  return { series, totals: { ytd: round2(ytd), projection: round2(projection), months } };
});

// ---------------------------------------------------------------------------
// reports.costBreakdown — labor vs materials vs overhead per trade
// ---------------------------------------------------------------------------
export const getCostBreakdown = makeAuthFn("reports.costBreakdown", async (args, userId, pool) => {
  const { where, params } = await buildScope(pool, userId, args?.data || {});
  const rows = (await pool.query(
    `SELECT e.trade,
       SUM(e.actual_material_cost) AS actual_material,
       SUM(e.actual_labor_cost) AS actual_labor,
       SUM(e.actual_other_cost) AS actual_other,
       COUNT(*) FILTER (WHERE (e.actual_material_cost + e.actual_labor_cost + e.actual_other_cost) > 0) AS jobs_with_actuals,
       COALESCE((SELECT SUM(li.quantity * li.unit_cost) FROM line_items li WHERE li.estimate_id = e.id AND LOWER(COALESCE(li.unit,'')) IN ('hr','hrs','hour','hours','manhour','man-hours')), 0) AS est_labor,
       COALESCE((SELECT SUM(li.quantity * li.unit_cost) FROM line_items li WHERE li.estimate_id = e.id AND LOWER(COALESCE(li.unit,'')) NOT IN ('hr','hrs','hour','hours','manhour','man-hours')), 0) AS est_material,
       COALESCE((SELECT SUM((li.quantity * li.unit_cost) * (li.markup_percent / 100.0)) FROM line_items li WHERE li.estimate_id = e.id), 0) AS est_markup
     FROM estimates e ${where} GROUP BY e.trade ORDER BY (SUM(e.actual_material_cost) + SUM(e.actual_labor_cost) + SUM(e.actual_other_cost)) DESC`, params)).rows;

  const hasActuals = rows.some((r: any) => num(r.actual_material) + num(r.actual_labor) + num(r.actual_other) > 0);
  const breakdown = rows.map((r: any) => {
    const actual = {
      material: round2(num(r.actual_material)), labor: round2(num(r.actual_labor)), other: round2(num(r.actual_other)),
    };
    const estimated = {
      material: round2(num(r.est_material)), labor: round2(num(r.est_labor)), overhead: round2(num(r.est_markup)),
    };
    return { trade: r.trade, source: hasActuals ? "actual" : "estimated", actual, estimated };
  });
  const totals = breakdown.reduce(
    (s: any, b: any) => {
      s.material += hasActuals ? b.actual.material : b.estimated.material;
      s.labor += hasActuals ? b.actual.labor : b.estimated.labor;
      s.other += hasActuals ? b.actual.other : b.estimated.overhead;
      return s;
    },
    { material: 0, labor: 0, other: 0 }
  );
  return { breakdown, totals: { material: round2(totals.material), labor: round2(totals.labor), other: round2(totals.other), source: hasActuals ? "actual" : "estimated" } };
});

function round2(n: number) { return Math.round(n * 100) / 100; }
function round1(n: number) { return Math.round(n * 10) / 10; }
