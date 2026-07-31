import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { listUsers, setUserPlan, toggleUserFrozen, deleteUser } from "~/lib/admin";
import { getCurrentUser } from "~/lib/auth";

export const Route = createFileRoute("/admin")({
  loader: async () => {
    const { user } = await getCurrentUser();
    if (!user?.isAdmin) throw new (await import("@tanstack/react-router")).redirect({ to: "/dashboard" });
    const { users, stats } = await listUsers();
    return { user, users, stats };
  },
  component: AdminDashboard,
});

const PLANS = ["trial", "free", "starter", "pro", "shop"] as const;

function AdminDashboard() {
  const router = useRouter();
  const { user, users, stats } = Route.useLoaderData();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const handleChangePlan = async (userId: string, tier: string) => {
    if (!confirm(`Change this user's plan to ${tier}?`)) return;
    setActionError("");
    try {
      await setUserPlan({ data: { userId, tier } });
      router.navigate({ to: "/admin" });
    } catch (err: any) {
      setActionError(err.message || "Failed to change plan");
    }
  };

  const handleToggleFrozen = async (userId: string, currentFrozen: number) => {
    const action = currentFrozen === 1 ? "unfreeze" : "freeze";
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} this user?`)) return;
    setActionError("");
    try {
      await toggleUserFrozen({ data: { userId } });
      router.navigate({ to: "/admin" });
    } catch (err: any) {
      setActionError(err.message || `Failed to ${action}`);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Permanently delete this user and ALL their data? This cannot be undone.")) return;
    setActionError("");
    try {
      await deleteUser({ data: { userId } });
      router.navigate({ to: "/admin" });
    } catch (err: any) {
      setActionError(err.message || "Failed to delete user");
    }
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString() : "—";

  const statusBadge = (frozen: number) =>
    frozen === 1
      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
      : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400";

  const tierLabel = (t: string) =>
    t === "trial" ? "Trial" : t === "free" ? "Free" : t === "starter" ? "Starter" : t === "pro" ? "Pro" : "Shop";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</span>
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="text-gray-600 dark:text-gray-400">{user.email}</span>
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Dashboard</Link>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400">Admin</span>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage users, subscriptions, and account status</p>

        {actionError && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">{actionError}</div>
        )}

        {/* Stats cards */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Total Users</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/30">
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.activeTrials}</p>
            <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">Active Trials</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-900 dark:bg-green-950/30">
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.paying}</p>
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">Paying Users</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30">
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.frozen}</p>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">Frozen</p>
          </div>
        </div>

        {/* Users table */}
        <div className="mt-8 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-950">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Email</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Plan</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Trial Ends</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Joined</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Ests</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{u.email}</span>
                    {u.role === "admin" && (
                      <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400">admin</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{u.name}</td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-gray-700 dark:text-gray-300">{tierLabel(u.subscription_tier)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDate(u.trial_ends_at)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{u.estimate_count || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(u.frozen)}`}>
                      {u.frozen === 1 ? "Frozen" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* Change plan dropdown */}
                      <select
                        value={""}
                        onChange={(e) => {
                          if (e.target.value) handleChangePlan(u.id, e.target.value);
                        }}
                        className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
                      >
                        <option value="">Set plan…</option>
                        {PLANS.map((p) => (
                          <option key={p} value={p} disabled={p === u.subscription_tier}>
                            {tierLabel(p)}{p === u.subscription_tier ? " ✓" : ""}
                          </option>
                        ))}
                      </select>
                      {/* Freeze/Unfreeze toggle */}
                      <button
                        onClick={() => handleToggleFrozen(u.id, u.frozen)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                      >
                        {u.frozen === 1 ? "Unfreeze" : "Freeze"}
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">No users found.</div>
          )}
        </div>
      </main>
    </div>
  );
}
