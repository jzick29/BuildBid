import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { UpgradeGate } from "~/components/UpgradeBanner";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

const F = (n: any, d = 0) => {
  const v = Number(n || 0);
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};
const money = (n: any) => "$" + F(n, 0);
const pct = (n: any) => F(n, 1) + "%";

const RANGES = [
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
  { key: "365", label: "1y" },
  { key: "all", label: "All" },
  { key: "custom", label: "Custom" },
];

function ReportsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<any>({ range: "365" });
  const [filterMeta, setFilterMeta] = useState<any>({ trades: [], estimators: [] });
  const [months, setMonths] = useState(12);
  const [data, setData] = useState<any>(null);

  const call = useCallback(async (fn: string, data: any) => {
    const res = await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: fn, args: { data } }), credentials: "include",
    });
    return res.json();
  }, []);

  const load = useCallback(async (f: any, m: number) => {
    setLoading(true);
    try {
      const [filtersRes, prof, wl, est, rev, cost] = await Promise.all([
        call("reports.filters", f),
        call("reports.profitability", f),
        call("reports.winLoss", f),
        call("reports.estimatorPerformance", f),
        call("reports.revenueTrends", { ...f, months: m }),
        call("reports.costBreakdown", f),
      ]);
      setFilterMeta(filtersRes);
      setData({ profit: prof, winLoss: wl, estimators: est, revenue: rev, cost });
      setError("");
    } catch (e: any) { setError(e.message || "Failed to load reports"); }
    finally { setLoading(false); }
  }, [call]);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        const meData = await meRes.json();
        if (!meData.user) { window.location.href = "/login"; return; }
        setUser(meData.user);
        await load(filters, months);
      } catch (e: any) { setError(e.message); setLoading(false); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = (next: any, m?: number) => {
    const merged = { ...filters, ...next };
    setFilters(merged);
    const mm = m ?? months;
    if (m) setMonths(m);
    load(merged, mm);
  };

  if (loading && !data) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading reports…</p></div>;
  if (error && !data) return <div className="flex min-h-dvh items-center justify-center"><div className="text-center"><p className="text-red-500">Error: {error}</p><button onClick={() => window.location.reload()} className="mt-4 text-indigo-600 underline">Retry</button></div></div>;
  if (!user) return null;

  // ---- derived metrics ----
  const winLoss = data?.winLoss || { summary: { total: 0, won: 0, lost: 0, winRate: 0 }, byTrade: [], byMonth: [], bySize: [] };
  const profit = data?.profit || { jobs: [], summary: { totalEstimatedRevenue: 0, avgMarginPct: 0, bestTrade: null, jobsWithActuals: 0 } };
  const revenue = data?.revenue || { series: [], totals: { ytd: 0, projection: 0 } };
  const cost = data?.cost || { breakdown: [], totals: { material: 0, labor: 0, other: 0, source: "estimated" } };
  const estimators = data?.estimators?.estimators || [];

  const wonRevenue = winLoss.byMonth.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
  const decidedJobs = profit.jobs.filter((j: any) => j.status === "won" || j.status === "lost");
  const avgEstimateSize = decidedJobs.length ? decidedJobs.reduce((s: number, j: any) => s + j.estRevenue, 0) / decidedJobs.length : 0;

  // revenue chart dims
  const maxRev = Math.max(...revenue.series.map((r: any) => Math.max(Number(r.revenue || 0), Number(r.prevYear || 0))), 1);
  // cost chart
  const costMax = Math.max(cost.totals.material, cost.totals.labor, cost.totals.other, 1);
  const costColor = (k: string) => k === "material" ? "bg-indigo-500" : k === "labor" ? "bg-amber-500" : "bg-emerald-500";
  // win rate bar color
  const barColor = (rate: number) => rate >= 70 ? "fill-green-500" : rate >= 40 ? "fill-yellow-500" : "fill-red-500";
  const maxWinTotal = Math.max(...(winLoss.byTrade || []).map((t: any) => t.total), 1);

  return (
    <div className="flex min-h-dvh flex-col">
      <style>{`
        @media print {
          aside, header, nav.fixed, .print-hide { display: none !important; }
          main { margin: 0 !important; max-width: 100% !important; padding: 0 !important; }
          .print-block { box-shadow: none !important; border-color: #ddd !important; break-inside: avoid; }
        }
      `}</style>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3 print-hide">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Profitability, win/loss and estimator performance</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/analytics" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900">Analytics</Link>
            <button onClick={() => window.print()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">Export PDF</button>
          </div>
        </div>
        <UpgradeGate feature="Reporting Dashboard" requiredTier="pro" subscriptionTier={user.subscriptionTier} />

        {/* Filter bar */}
        <div className="print-hide mt-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
              {RANGES.map((r) => (
                <button key={r.key} onClick={() => applyFilters({ range: r.key, from: "", to: "" })} className={`px-3 py-1.5 text-sm font-medium ${filters.range === r.key ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}>{r.label}</button>
              ))}
            </div>
            {filters.range === "custom" && (
              <div className="flex items-center gap-2 text-sm">
                <input type="date" value={filters.from || ""} onChange={(e) => applyFilters({ from: e.target.value })} className="rounded-lg border border-gray-300 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-950" />
                <span className="text-gray-400">→</span>
                <input type="date" value={filters.to || ""} onChange={(e) => applyFilters({ to: e.target.value })} className="rounded-lg border border-gray-300 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-950" />
              </div>
            )}
            <select value={filters.trade || ""} onChange={(e) => applyFilters({ trade: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950">
              <option value="">All trades</option>
              {(filterMeta.trades || []).map((t: string) => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
            <select value={filters.estimatorId || ""} onChange={(e) => applyFilters({ estimatorId: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950">
              <option value="">All estimators</option>
              {(filterMeta.estimators || []).map((e: any) => <option key={e.id} value={e.id}>{e.name || e.email}</option>)}
            </select>
            <div className="ml-auto flex items-center gap-1 text-xs text-gray-500">
              <span className="mr-1">Trend:</span>
              {[6, 12, 24].map((m) => (
                <button key={m} onClick={() => applyFilters({}, m)} className={`rounded px-2 py-1 font-medium ${months === m ? "bg-indigo-600 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}>{m}mo</button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Revenue (won)</p>
            <p className="mt-1 text-2xl font-bold">{money(wonRevenue)}</p>
            <p className="text-xs text-gray-500">{winLoss.summary.won} won jobs</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Avg Margin</p>
            <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{pct(profit.summary.avgMarginPct)}</p>
            <p className="text-xs text-gray-500">On {decidedJobs.length} decided jobs</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Win Rate</p>
            <p className="mt-1 text-2xl font-bold">{pct(winLoss.summary.winRate)}</p>
            <p className="text-xs text-gray-500">{winLoss.summary.won}W / {winLoss.summary.lost}L</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Avg Estimate Size</p>
            <p className="mt-1 text-2xl font-bold">{money(avgEstimateSize)}</p>
            <p className="text-xs text-gray-500">Best: {profit.summary.bestTrade ? <span className="capitalize">{profit.summary.bestTrade.trade} ({pct(profit.summary.bestTrade.marginPct)})</span> : "n/a"}</p>
          </div>
        </div>

        {/* Revenue trend */}
        {revenue.series.length > 0 && (
          <div className="print-block mt-8 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Revenue Trend</h2>
                <p className="text-sm text-gray-500">Monthly won revenue (blue) vs prior year (gray)</p>
              </div>
              <div className="flex gap-4 text-xs text-gray-500">
                <span>YTD: <b className="text-gray-900 dark:text-gray-100">{money(revenue.totals.ytd)}</b></span>
                <span>Projected: <b className="text-gray-900 dark:text-gray-100">{money(revenue.totals.projection)}</b></span>
              </div>
            </div>
            <div className="mt-4 flex items-end gap-1.5 h-44">
              {revenue.series.map((r: any) => (
                <div key={r.month} className="group relative flex flex-1 flex-col items-center justify-end" style={{ minWidth: 0 }}>
                  <span className="mb-0.5 hidden text-[9px] text-gray-400 group-hover:block">{money(r.revenue)}</span>
                  {Number(r.prevYear) > 0 && <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-t" style={{ height: `${Math.max((Number(r.prevYear) / maxRev) * 100, 1)}%` }} />}
                  <div className="w-full bg-indigo-500 rounded-t group-hover:bg-indigo-600 transition-colors" style={{ height: `${Math.max((Number(r.revenue) / maxRev) * 100, Number(r.revenue) > 0 ? 2 : 0.5)}%` }} />
                  <span className="mt-1 text-[9px] text-gray-400">{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Cost breakdown */}
          {cost.breakdown.length > 0 && (
            <div className="print-block rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-lg font-semibold">Cost Breakdown</h2>
              <p className="text-sm text-gray-500">{cost.totals.source === "actual" ? "Actual costs by trade" : "Estimated costs by trade (labor units vs materials)"}</p>
              <div className="mt-5 space-y-4">
                {cost.breakdown.map((b: any) => {
                  const m = b.actual ? b.actual.material : b.estimated.material;
                  const l = b.actual ? b.actual.labor : b.estimated.labor;
                  const o = b.actual ? b.actual.other : b.estimated.overhead;
                  const total = m + l + o || 1;
                  return (
                    <div key={b.trade}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">{b.trade}</span>
                        <span className="text-gray-500">{money(total)}</span>
                      </div>
                      <div className="flex h-5 w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                        <div className={costColor("material")} style={{ width: `${(m / total) * 100}%` }} title={`Materials ${money(m)}`} />
                        <div className={costColor("labor")} style={{ width: `${(l / total) * 100}%` }} title={`Labor ${money(l)}`} />
                        <div className={costColor("other")} style={{ width: `${(o / total) * 100}%` }} title={`Other/Markup ${money(o)}`} />
                      </div>
                      <div className="mt-1 flex gap-3 text-[10px] text-gray-500">
                        <span><i className={`mr-1 inline-block h-2 w-2 rounded-sm ${costColor("material")}`} />Mat {money(m)}</span>
                        <span><i className={`mr-1 inline-block h-2 w-2 rounded-sm ${costColor("labor")}`} />Labor {money(l)}</span>
                        <span><i className={`mr-1 inline-block h-2 w-2 rounded-sm ${costColor("other")}`} />{cost.totals.source === "actual" ? "Other" : "Markup"} {money(o)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Win rate by trade */}
          {winLoss.byTrade.length > 0 && (
            <div className="print-block rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-lg font-semibold">Win Rate by Trade</h2>
              <div className="mt-5 space-y-4">
                {winLoss.byTrade.map((t: any) => {
                  const w = Math.max(4, (t.total / maxWinTotal) * 100);
                  return (
                    <div key={t.trade}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">{t.trade}</span>
                        <span className="text-gray-500">{pct(t.winRate)} ({t.won}/{t.total})</span>
                      </div>
                      <svg width="100%" height="28" className="overflow-visible">
                        <rect x="0" y="4" width="100%" height="20" rx="10" className="fill-gray-100 dark:fill-gray-800" />
                        <rect x="0" y="4" width={`${w}%`} height="20" rx="10" className={barColor(t.winRate)} />
                      </svg>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Profitability table */}
        {profit.jobs.length > 0 && (
          <div className="print-block mt-8 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between bg-white px-6 pt-6 dark:bg-gray-900">
              <div>
                <h2 className="text-lg font-semibold">Profitability by Job</h2>
                <p className="text-sm text-gray-500">Estimated vs actual costs and margins</p>
              </div>
              <span className="text-xs text-gray-500">{profit.summary.jobsWithActuals} jobs with actual costs</span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-950">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Job</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Trade</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Est. Cost</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Est. Revenue</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Margin</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Actual</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {profit.jobs.slice(0, 50).map((j: any) => (
                    <tr key={j.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                      <td className="px-4 py-3">
                        <Link to="/estimates/$id" params={{ id: j.id }} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">{j.projectName}</Link>
                        <div className="text-xs text-gray-500">{j.customerName}</div>
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-600 dark:text-gray-400">{j.trade}</td>
                      <td className="px-4 py-3 text-right">{money(j.estCost)}</td>
                      <td className="px-4 py-3 text-right font-medium">{money(j.estRevenue)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={j.estMarginPct >= 40 ? "text-green-600 dark:text-green-400" : j.estMarginPct >= 15 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}>{pct(j.estMarginPct)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {j.actualCost > 0 ? (
                          <>
                            <span className="font-medium">{money(j.actualCost)}</span>
                            {j.actualMarginPct != null && <div className={`text-xs ${j.actualMarginPct >= 0 ? "text-green-600" : "text-red-600"}`}>{j.actualMarginPct >= 0 ? "+" : ""}{pct(j.actualMarginPct)}</div>}
                          </>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${j.status === "won" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : j.status === "lost" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>{j.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Estimator performance */}
          {estimators.length > 0 && (
            <div className="print-block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="bg-white px-6 pt-6 dark:bg-gray-900"><h2 className="text-lg font-semibold">Estimator Performance</h2></div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-950">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Estimator</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Bids</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Win Rate</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Avg Bid</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Revenue</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Turnaround</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {estimators.map((e: any) => (
                      <tr key={e.estimatorId} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                        <td className="px-4 py-3 font-medium">{e.name || e.email}</td>
                        <td className="px-4 py-3 text-right">{e.estimates}</td>
                        <td className="px-4 py-3 text-right font-medium">{pct(e.winRate)}</td>
                        <td className="px-4 py-3 text-right">{money(e.avgBid)}</td>
                        <td className="px-4 py-3 text-right">{money(e.totalRevenue)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{e.avgTurnoverDays ? e.avgTurnoverDays + "d" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Win/loss by size + month */}
          {(winLoss.bySize.length > 0 || winLoss.byMonth.length > 0) && (
            <div className="print-block space-y-6">
              {winLoss.bySize.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                  <div className="bg-white px-6 pt-6 dark:bg-gray-900"><h2 className="text-lg font-semibold">Win/Loss by Job Size</h2></div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-950">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">Job Size</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500">Won</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500">Lost</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500">Win Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {winLoss.bySize.map((b: any) => (
                          <tr key={b.bucket} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                            <td className="px-4 py-3">{b.bucket}</td>
                            <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{b.won}</td>
                            <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">{b.lost}</td>
                            <td className="px-4 py-3 text-right font-medium">{pct(b.winRate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {winLoss.byMonth.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                  <div className="bg-white px-6 pt-6 dark:bg-gray-900"><h2 className="text-lg font-semibold">Win Rate by Month</h2></div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-950">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">Month</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500">Decided</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500">Won</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500">Win Rate</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500">Won Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {winLoss.byMonth.slice(-12).map((m: any) => (
                          <tr key={m.month} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                            <td className="px-4 py-3">{m.month}</td>
                            <td className="px-4 py-3 text-right">{m.total}</td>
                            <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{m.won}</td>
                            <td className="px-4 py-3 text-right font-medium">{pct(m.winRate)}</td>
                            <td className="px-4 py-3 text-right">{money(m.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {winLoss.summary.total === 0 && (
          <div className="mt-10 rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">No estimate data in this range yet</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Create estimates and mark them won/lost to populate reports.</p>
            <Link to="/estimates/new" className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Create an Estimate</Link>
          </div>
        )}
      </main>
    </div>
  );
}
