import { createFileRoute, Link, useRouter, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser, logout } from "~/lib/auth";
import { listEstimates } from "~/lib/estimates";
import { submitFeedback } from "~/lib/feedback";
import { getRecentViews } from "~/lib/tracking";
import { useState, useEffect } from "react";

function UpcomingJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    import("~/lib/scheduling").then(m => m.getScheduledJobs({ data: { month } }).then(j => setJobs(j.slice(0,5)))).catch(() => {});
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

const getDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  const estimates = await listEstimates();
  const mod = await import("~/lib/db.server");
  const db = await mod.getDb();
  const views = db.query(
    "SELECT pv.*, e.project_name, e.customer_name FROM proposal_views pv JOIN estimates e ON e.id = pv.estimate_id ORDER BY pv.viewed_at DESC LIMIT 5"
  ).all() as any[];
  return {
    totalEstimates: estimates.length,
    draftCount: estimates.filter((e: any) => e.status === "draft").length,
    wonCount: estimates.filter((e: any) => e.status === "won").length,
    lostCount: estimates.filter((e: any) => e.status === "lost").length,
    recentEstimates: estimates.slice(0, 5),
    recentActivity: views,
  };
});

export const Route = createFileRoute("/dashboard")({
  loader: async () => {
    let expiringContracts: any[] = [];
    let upcomingVisits: any[] = [];
    try { expiringContracts = await getExpiringContracts(); } catch {}
    try { upcomingVisits = await getUpcomingVisits({ data: { days: 14 } }); } catch {}

    const [user, data] = await Promise.all([
      getCurrentUser(),
      getDashboardData(),
    ]);
    if (!user.user) {
      throw redirect({ to: "/login" });
    }
    const result = { user: user.user, ...data }; return result;
  },
  component: Dashboard,
});

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  won: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  lost: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function Dashboard() {
  const router = useRouter();
  const { user, totalEstimates, draftCount, wonCount, lostCount, recentEstimates } = Route.useLoaderData();
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  useEffect(() => {
    getRecentViews().then(rows => rows && setRecentActivity(rows.slice(0, 5))).catch(() => {});
  }, []);

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

  const dismissTips = () => {
    localStorage.setItem("buildbid_tips_dismissed", "1");
    setTipsDismissed(true);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackMsg.trim() || feedbackSubmitting) return;
    setFeedbackSubmitting(true);
    try {
      await submitFeedback({ data: { message: feedbackMsg, rating: feedbackRating } });
      setFeedbackSent(true);
      setTimeout(() => { setFeedbackOpen(false); setFeedbackSent(false); setFeedbackMsg(""); setFeedbackRating(0); }, 2000);
    } catch (e) {
      // silently fail
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.navigate({ to: "/" });
  };

  const planLabel = user.subscriptionTier === "free" ? "Free" : (user.subscriptionTier || "trial").charAt(0).toUpperCase() + (user.subscriptionTier || "trial").slice(1);
  const planBadgeColor = user.subscriptionTier === "free"
    ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
    : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            BuildBid
          </span>
          <div className="flex items-center gap-6 text-sm font-medium">
            <Link to="/" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Home
            </Link>
            <Link to="/estimates" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Estimates
            </Link>
            <Link to="/templates" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Templates
            </Link>
            <Link to="/analytics" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Analytics
            </Link>
            <Link to="/customers" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Customers
            </Link>
            <Link to="/materials" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Materials
            </Link>
            <Link to="/team" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Team
            </Link>
            <Link to="/invoices" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Invoices
            </Link>
            <Link to="/contracts" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Contracts
            </Link>
            {user.isAdmin && (
              <Link to="/admin" className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:hover:bg-amber-900">
                Admin
              </Link>
            )}
            <Link to="/schedule" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Schedule
            </Link>
            <Link to="/price-lists" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Price Lists
            </Link>
            <Link to="/integrations" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Integrations
            </Link>
            <Link to="/share" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Share
            </Link>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${planBadgeColor}`}>
              {planLabel}
              {user.plan === "free" && (
                <Link to="/" className="ml-1 underline hover:no-underline">Upgrade</Link>
              )}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {user.name || user.email}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
            >
              Sign Out
            </button>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        {/* Tips Banner */}
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
          <Link
            to="/estimates/new"
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            New Estimate
          </Link>
        </div>

        {/* Stats cards */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
        </div>

        {/* Recent estimates */}
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
        {/* Upcoming Jobs */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold">Upcoming Jobs</h2>
          <UpcomingJobs />
        </div>

        {/* Recent Proposal Activity */}
        {recentActivity.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-semibold">Recent Proposal Activity</h2>
            <div className="mt-4 space-y-2">
              {recentActivity.map((act: any) => (
                <div key={act.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-800">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-green-500"></span>
                  <span>
                    <strong>{act.customer_name}</strong> opened <em>{act.project_name}</em>
                  </span>
                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                    {new Date(act.viewed_at + "Z").toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Feedback floating button */}
      <button
        onClick={() => setFeedbackOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-indigo-700 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
        </svg>
        Feedback
      </button>

      {/* Feedback modal */}
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
