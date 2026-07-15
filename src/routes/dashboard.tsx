import { createFileRoute, Link, useRouter, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser, logout } from "~/lib/auth";
import { listEstimates } from "~/lib/estimates";

const getDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  const estimates = await listEstimates();
  return {
    totalEstimates: estimates.length,
    draftCount: estimates.filter((e: any) => e.status === "draft").length,
    wonCount: estimates.filter((e: any) => e.status === "won").length,
    lostCount: estimates.filter((e: any) => e.status === "lost").length,
    recentEstimates: estimates.slice(0, 5),
  };
});

export const Route = createFileRoute("/dashboard")({
  loader: async () => {
    const [user, data] = await Promise.all([
      getCurrentUser(),
      getDashboardData(),
    ]);
    if (!user.user) {
      throw redirect({ to: "/login" });
    }
    return { user: user.user, ...data };
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

  const handleLogout = async () => {
    await logout();
    router.navigate({ to: "/" });
  };

  const planLabel = user.plan === "free" ? "Free" : user.plan?.charAt(0).toUpperCase() + user.plan?.slice(1);
  const planBadgeColor = user.plan === "free"
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
      </main>
    </div>
  );
}