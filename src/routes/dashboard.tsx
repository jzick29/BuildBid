import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/dashboard")({
  loader: async () => ({}),
  component: Dashboard,
});

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  won: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  lost: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function UpcomingJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "scheduling.getScheduledJobs", args: { data: { month } } }),
      credentials: "include",
    })
    .then(r => r.json())
    .then(j => { if (Array.isArray(j)) setJobs(j.slice(0,5)); })
    .catch(() => {});
  }, []);
  if (jobs.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      {jobs.map((j: any) => (
        <Link key={j.id} to="/estimates/$id" params={{ id: j.id }} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950">
          <div><p className="font-medium">{j.project_name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{j.customer_name} · {j.trade}</p></div>
          <span className="text-xs text-gray-400">{j.start_date} – {j.end_date}</span>
        </Link>
      ))}
    </div>
  );
}

function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [tipsDismissed, setTipsDismissed] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("buildbid_tips_dismissed");
    if (dismissed) setTipsDismissed(true);
  }, []);

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!d.user) { window.location.href = "/login"; return; }
        setUser(d.user);
        return fetch("/api/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ function: "estimates.listEstimates", args: {} }),
          credentials: "include",
        });
      })
      .then(r => r?.json())
      .then(d => { if (d?.estimates) setEstimates(d.estimates); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const totalEstimates = estimates.length;
  const draftCount = estimates.filter((e: any) => e.status === "draft").length;
  const sentCount = estimates.filter((e: any) => e.status === "sent").length;
  const wonCount = estimates.filter((e: any) => e.status === "won").length;
  const lostCount = estimates.filter((e: any) => e.status === "lost").length;
  const recentEstimates = estimates.slice(0, 5);

  // Win rate
  const winRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;
  const winRateColor = winRate >= 50 ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30" : winRate >= 30 ? "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30";
  const winRateTextColor = winRate >= 50 ? "text-green-800 dark:text-green-300" : winRate >= 30 ? "text-yellow-800 dark:text-yellow-300" : "text-red-800 dark:text-red-300";

  // Pipeline value = sum of all non-lost estimate totals
  const pipelineTotal = estimates.filter((e: any) => e.status !== "lost").reduce((sum: number, e: any) => sum + (parseFloat(e.total) || 0), 0);

  // Pipeline stages
  const pipelineStages = ["draft", "sent", "won"];
  const pipelineMax = Math.max(draftCount + sentCount + wonCount, 1);

  // Trade chart
  const tradesMap: Record<string, number> = {};
  estimates.forEach((e: any) => {
    const t = e.trade || "general";
    tradesMap[t] = (tradesMap[t] || 0) + 1;
  });
  const tradeEntries = Object.entries(tradesMap).sort((a, b) => b[1] - a[1]);
  const tradeMax = Math.max(...tradeEntries.map(([,c]) => c), 1);

  const dismissTips = () => {
    localStorage.setItem("buildbid_tips_dismissed", "1");
    setTipsDismissed(true);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackMsg.trim() || feedbackSubmitting) return;
    setFeedbackSubmitting(true);
    try {
      await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "feedback.submit", args: { data: { message: feedbackMsg, rating: feedbackRating } } }),
        credentials: "include",
      });
      setFeedbackSent(true);
      setTimeout(() => { setFeedbackOpen(false); setFeedbackSent(false); setFeedbackMsg(""); setFeedbackRating(0); }, 2000);
    } catch (e) {
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    router.navigate({ to: "/" });
  };

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">{error}</p></div>;
  if (!user) return null;

  const planLabel = (user.subscriptionTier || "trial").charAt(0).toUpperCase() + (user.subscriptionTier || "trial").slice(1);
  const planBadgeColor = (user.subscriptionTier === "free" || user.subscriptionTier === "trial")
    ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
    : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400";

  return (
    <div className="flex min-h-dvh flex-col">

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        {!tipsDismissed && totalEstimates === 0 && (
          <div className="mb-8 flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/30">
            <div className="flex items-center gap-3">
              <span className="text-xl">💡</span>
              <div>
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">New around here? Here's what to do first.</p>
                <p className="mt-0.5 text-xs text-indigo-700 dark:text-indigo-400">
                  Create your first estimate → pick a template → customize it → send a professional PDF proposal to your client.
                  Try it now with <Link to="/estimates/new" className="underline font-medium">New Estimate</Link>.
                </p>
              </div>
            </div>
            <button onClick={dismissTips} className="ml-4 shrink-0 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {!tipsDismissed && totalEstimates > 0 && (
          <div className="mb-8 flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/30">
            <div className="flex items-center gap-3">
              <span className="text-xl">💡</span>
              <div>
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">Pro tip</p>
                <p className="mt-0.5 text-xs text-indigo-700 dark:text-indigo-400">
                  Check your <Link to="/analytics" className="underline font-medium">Analytics</Link> to see which trades have the best win rates and where to focus your bids.
                </p>
              </div>
            </div>
            <button onClick={dismissTips} className="ml-4 shrink-0 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Welcome back, {user.name || user.email}!
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/ai-estimate"
              className="rounded-lg border border-violet-200 bg-white px-5 py-2.5 text-sm font-semibold text-violet-600 shadow-sm hover:bg-violet-50 dark:border-violet-900 dark:bg-gray-900 dark:text-violet-400 dark:hover:bg-violet-950"
            >
              ✨ AI Estimate
            </Link>
            <Link
              to="/estimates/new"
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              New Estimate
            </Link>
          </div>
        </div>

        {/* Stat cards — 5 columns */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Estimates</p>
            <p className="mt-2 text-3xl font-bold">{totalEstimates}</p>
          </div>
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-900 dark:bg-yellow-950/30">
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Draft</p>
            <p className="mt-2 text-3xl font-bold text-yellow-800 dark:text-yellow-300">{draftCount}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950/30">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Won</p>
            <p className="mt-2 text-3xl font-bold text-green-800 dark:text-green-300">{wonCount}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Lost</p>
            <p className="mt-2 text-3xl font-bold text-red-800 dark:text-red-300">{lostCount}</p>
          </div>
          <div className={`rounded-xl border p-6 ${winRateColor}`}>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Win Rate</p>
            <p className={`mt-2 text-3xl font-bold ${winRateTextColor}`}>{winRate}%</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link to="/ai-estimate" className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/30 dark:hover:bg-violet-950/50 transition-colors">
              <svg className="h-6 w-6 text-violet-600 dark:text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>
              <span className="text-sm font-medium text-violet-700 dark:text-violet-300">AI Estimate</span>
            </Link>
            <Link to="/estimates/new" className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 transition-colors">
              <svg className="h-6 w-6 text-indigo-600 dark:text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">New Estimate</span>
            </Link>
            <Link to="/templates" className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-950 transition-colors">
              <svg className="h-6 w-6 text-gray-500 dark:text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Browse Templates</span>
            </Link>
            <Link to="/schedule" className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-950 transition-colors">
              <svg className="h-6 w-6 text-gray-500 dark:text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">View Schedule</span>
            </Link>
            <Link to="/invoices" className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-950 transition-colors">
              <svg className="h-6 w-6 text-gray-500 dark:text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Send Invoice</span>
            </Link>
          </div>
        </div>

        {/* Trade bar chart */}
        {tradeEntries.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Estimates by Trade</h2>
            <div className="mt-4 space-y-3">
              {tradeEntries.map(([trade, count]) => (
                <div key={trade} className="flex items-center gap-4">
                  <span className="w-24 text-sm text-gray-600 dark:text-gray-400 capitalize shrink-0">{trade}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 dark:bg-indigo-600 rounded-full transition-all duration-500 flex items-center justify-end pr-3"
                      style={{ width: `${(count / tradeMax) * 100}%` }}
                    >
                      <span className="text-xs font-medium text-white">{count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Estimates</h2>
            <Link to="/estimates" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              View all &rarr;
            </Link>
          </div>

          {recentEstimates.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">No estimates yet</p>
              <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
                Create your first estimate and start winning more work.
              </p>
              <Link
                to="/estimates/new"
                className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Create Your First Estimate
              </Link>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Project</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Client</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Trade</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {recentEstimates.map((est: any) => (
                    <tr key={est.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                      <td className="px-4 py-3">
                        <Link to="/estimates/$id" params={{ id: est.id }} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                          {est.project_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{est.customer_name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 capitalize">{est.trade}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[est.status] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"}`}>
                          {est.status?.charAt(0).toUpperCase() + est.status?.slice(1) || "Unknown"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Revenue Pipeline */}
        {totalEstimates > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Revenue Pipeline</h2>
            <div className="mt-4 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
              <div className="flex h-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                {pipelineStages.map((stage) => {
                  const count = estimates.filter((e: any) => e.status === stage).length;
                  const pct = pipelineMax > 0 ? (count / pipelineMax) * 100 : 0;
                  const colors: Record<string, string> = {
                    draft: "bg-yellow-400",
                    sent: "bg-blue-400",
                    won: "bg-green-400",
                  };
                  return (
                    <div
                      key={stage}
                      className={`${colors[stage] || "bg-gray-400"} flex items-center justify-center text-xs font-semibold text-white transition-all`}
                      style={{ width: `${pct}%`, minWidth: pct > 0 ? "2rem" : "0" }}
                    >
                      {count > 0 && count}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-between text-sm text-gray-500 dark:text-gray-400">
                {pipelineStages.map((stage) => {
                  const count = estimates.filter((e: any) => e.status === stage).length;
                  const pct = pipelineMax > 0 ? Math.round((count / pipelineMax) * 100) : 0;
                  return (
                    <span key={stage} className="capitalize">{stage} · {count} ({pct}%)</span>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Pipeline Value</span>
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">${pipelineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-10">
          <h2 className="text-xl font-semibold">Upcoming Jobs</h2>
          <UpcomingJobs />
        </div>
      </main>

      <button
        onClick={() => setFeedbackOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-indigo-700 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
        </svg>
        Feedback
      </button>

      {feedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFeedbackOpen(false)}>
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Send Feedback</h3>
              <button onClick={() => setFeedbackOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {feedbackSent ? (
              <div className="mt-6 rounded-lg bg-green-50 p-4 text-center text-sm font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
                Thanks for your feedback!
              </div>
            ) : (
              <>
                <div className="mt-4 flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setFeedbackRating(n)}
                      className={`text-2xl ${n <= feedbackRating ? "text-amber-400" : "text-gray-300 dark:text-gray-600"}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <textarea
                  value={feedbackMsg}
                  onChange={e => setFeedbackMsg(e.target.value)}
                  placeholder="Tell us what you think — what's working, what's missing, what would make BuildBid better for your trade?"
                  className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  rows={4}
                />
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setFeedbackOpen(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitFeedback}
                    disabled={!feedbackMsg.trim() || feedbackSubmitting}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {feedbackSubmitting ? "Sending..." : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
