import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getAnalytics } from "~/lib/analytics";
import { UpgradeGate } from "~/components/UpgradeBanner";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        const meData = await meRes.json();
        if (!meData.user) { window.location.href = "/login"; return; }
        setUser(meData.user);
        const d = await getAnalytics();
        setData(d);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleLogout = async () => { await fetch("/api/logout", { method: "POST" }); router.navigate({ to: "/" }); };

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading analytics...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><div className="text-center"><p className="text-red-500">Error: {error}</p><button onClick={() => window.location.reload()} className="mt-4 text-indigo-600 underline">Retry</button></div></div>;
  if (!user || !data) return null;

  const { totalEstimates, wonCount, lostCount, winRate, avgMarkup, totalRevenue, byTrade, byMonth, recentWins } = data;
  const maxWinRate = Math.max(...(byTrade||[]).map((t: any) => t.win_rate), 1);
  const barColor = (rate: number) => rate >= 70 ? "fill-green-500" : rate >= 40 ? "fill-yellow-500" : "fill-red-500";
  const StatusColors: Record<string,string> = { draft:"text-gray-400", sent:"text-blue-500", won:"text-green-600", lost:"text-red-500" };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</span>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Dashboard</Link>
            <Link to="/estimates" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Estimates</Link>
            <Link to="/templates" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Templates</Link>
            <Link to="/analytics" className="text-indigo-600 font-semibold dark:text-indigo-400">Analytics</Link>
            <span className="text-gray-600 dark:text-gray-400">{user.email}</span>
            <button onClick={handleLogout} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900">Sign Out</button>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold tracking-tight">Analytics</h1><p className="mt-2 text-gray-600 dark:text-gray-400">Your estimating performance at a glance</p></div>
          <Link to="/estimates/new" className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">New Estimate</Link>
        </div>
        <UpgradeGate feature="Job Costing & Analytics" requiredTier="pro" subscriptionTier={user.subscriptionTier} />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"><p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Estimates</p><p className="mt-2 text-3xl font-bold">{totalEstimates}</p></div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-900 dark:bg-indigo-950/30"><p className="text-sm font-medium text-indigo-700 dark:text-indigo-400">Win Rate</p><p className="mt-2 text-3xl font-bold text-indigo-800 dark:text-indigo-300">{winRate}%</p><p className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">{wonCount} won / {lostCount} lost</p></div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950/30"><p className="text-sm font-medium text-green-700 dark:text-green-400">Total Revenue</p><p className="mt-2 text-3xl font-bold text-green-800 dark:text-green-300">${Number(totalRevenue).toLocaleString()}</p><p className="mt-1 text-xs text-green-600 dark:text-green-400">From won estimates</p></div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/30"><p className="text-sm font-medium text-blue-700 dark:text-blue-400">Avg Markup</p><p className="mt-2 text-3xl font-bold text-blue-800 dark:text-blue-300">{avgMarkup}%</p><p className="mt-1 text-xs text-blue-600 dark:text-blue-400">On won jobs</p></div>
        </div>
        {(byTrade||[]).length > 0 && (
          <div className="mt-10 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold">Win Rate by Trade</h2>
            <div className="mt-6 space-y-4">{byTrade.map((t: any) => { const pct = Math.max(4, (t.win_rate / maxWinRate) * 100); return <div key={t.trade}><div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium capitalize">{t.trade}</span><span className="text-gray-500">{t.win_rate}% ({t.won_count}/{t.count})</span></div><svg width="100%" height="24" className="overflow-visible"><rect x="0" y="4" width="100%" height="16" rx="8" className="fill-gray-100 dark:fill-gray-800"/><rect x="0" y="4" width={`${pct}%`} height="16" rx="8" className={barColor(t.win_rate)}/></svg></div>; })}</div>
          </div>
        )}
        {(byTrade||[]).length > 0 && (
          <div className="mt-10"><h2 className="text-lg font-semibold">By Trade Breakdown</h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800"><table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-950"><tr><th className="px-4 py-3 text-left font-medium text-gray-500">Trade</th><th className="px-4 py-3 text-right font-medium text-gray-500">Estimates</th><th className="px-4 py-3 text-right font-medium text-gray-500">Won</th><th className="px-4 py-3 text-right font-medium text-gray-500">Win Rate</th><th className="px-4 py-3 text-right font-medium text-gray-500">Avg Markup</th><th className="px-4 py-3 text-right font-medium text-gray-500">Avg Bid</th></tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-800">{byTrade.map((t: any) => <tr key={t.trade} className="hover:bg-gray-50 dark:hover:bg-gray-950"><td className="px-4 py-3 font-medium capitalize">{t.trade}</td><td className="px-4 py-3 text-right">{t.count}</td><td className="px-4 py-3 text-right">{t.won_count}</td><td className="px-4 py-3 text-right">{t.win_rate}%</td><td className="px-4 py-3 text-right">{t.avg_markup}%</td><td className="px-4 py-3 text-right font-medium">${Number(t.avg_grand_total).toLocaleString()}</td></tr>)}</tbody></table></div>
          </div>
        )}
        {(recentWins||[]).length > 0 && (
          <div className="mt-10"><h2 className="text-lg font-semibold">Recent Wins</h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800"><table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-950"><tr><th className="px-4 py-3 text-left font-medium text-gray-500">Project</th><th className="px-4 py-3 text-left font-medium text-gray-500">Client</th><th className="px-4 py-3 text-left font-medium text-gray-500">Trade</th><th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th><th className="px-4 py-3 text-right font-medium text-gray-500">Date</th></tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-800">{recentWins.map((e: any) => <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-950"><td className="px-4 py-3"><Link to="/estimates/$id" params={{ id: e.id }} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">{e.project_name}</Link></td><td className="px-4 py-3 text-gray-600 dark:text-gray-400">{e.customer_name}</td><td className="px-4 py-3 capitalize text-gray-600 dark:text-gray-400">{e.trade}</td><td className="px-4 py-3 text-right font-medium">${Number(e.grand_total).toLocaleString()}</td><td className="px-4 py-3 text-right text-gray-500">{new Date(e.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>
          </div>
        )}
        {totalEstimates === 0 && (
          <div className="mt-10 rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700"><p className="text-gray-500 dark:text-gray-400">No estimates yet</p><p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Create your first estimate to see analytics.</p><Link to="/estimates/new" className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Create Your First Estimate</Link></div>
        )}
      </main>
    </div>
  );
}
