import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/admin")({ component: AdminDashboard });

const PLANS = ["trial", "free", "starter", "pro", "shop"] as const;

function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [platformStats, setPlatformStats] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [tab, setTab] = useState<"users"|"audit"|"health">("users");

  const loadData = async () => {
    const meRes = await fetch("/api/me", { credentials: "include" });
    const meData = await meRes.json();
    if (!meData.user) { window.location.href = "/login"; return; }
    setUser(meData.user);
    const res = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "admin.listUsers", args: {} }), credentials: "include" });
    const d = await res.json();
    if (d.users) { setUsers(d.users); setStats(d.stats || {}); }
    setLoading(false);
  };

  const loadPlatformStats = async () => {
    const r = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "admin.getPlatformStats", args: {} }), credentials: "include" }).then(r => r.json());
    setPlatformStats(r);
  };

  const loadAuditLog = async () => {
    const r = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "admin.getAuditLog", args: {} }), credentials: "include" }).then(r => r.json());
    setAuditLog(Array.isArray(r) ? r : []);
  };

  const loadHealth = async () => {
    const r = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "admin.healthCheck", args: {} }), credentials: "include" }).then(r => r.json());
    setHealth(r);
  };

  useEffect(() => { loadData(); }, []);

  const handleChangePlan = async (userId: string, tier: string) => {
    if (!confirm(`Change this user's plan to ${tier}?`)) return;
    setActionError("");
    try {
      await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "admin.setUserPlan", args: { data: { userId, tier } } }), credentials: "include" });
      loadData();
    } catch (err: any) { setActionError(err.message || "Failed"); }
  };

  const handleToggleFrozen = async (userId: string, currentFrozen: number) => {
    const action = currentFrozen === 1 ? "unfreeze" : "freeze";
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} this user?`)) return;
    setActionError("");
    try {
      await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "admin.toggleUserFrozen", args: { data: { userId } } }), credentials: "include" });
      loadData();
    } catch (err: any) { setActionError(err.message || `Failed to ${action}`); }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Permanently delete this user and ALL their data? This cannot be undone.")) return;
    setActionError("");
    try {
      await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "admin.deleteUser", args: { data: { userId } } }), credentials: "include" });
      loadData();
    } catch (err: any) { setActionError(err.message || "Failed to delete user"); }
  };

  const handleSetRole = async (userId: string, role: string) => {
    if (!confirm(`Set role to ${role}?`)) return;
    await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "admin.setUserRole", args: { data: { userId, role } } }), credentials: "include" });
    loadData();
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : "—";
  const statusBadge = (frozen: number) => frozen === 1 ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400";
  const tierLabel = (t: string) => t === "trial" ? "Trial" : t === "free" ? "Free" : t === "starter" ? "Starter" : t === "pro" ? "Pro" : "Shop";

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</span>
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="text-gray-600 dark:text-gray-400">{user?.email}</span>
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Dashboard</Link>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400">Admin</span>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage users, subscriptions, audit log, and system health</p>

        {actionError && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">{actionError}</div>}

        {/* Tabs */}
        <div className="mt-6 flex gap-2 border-b border-gray-200 dark:border-gray-800 pb-px">
          {[{ key: "users", label: "Users" }, { key: "audit", label: "Audit Log" }, { key: "health", label: "Health" }].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key as any); if (t.key === "audit") loadAuditLog(); if (t.key === "health") { loadHealth(); loadPlatformStats(); } }}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${tab === t.key ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {tab === "users" && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"><p className="text-2xl font-bold">{stats.total}</p><p className="mt-1 text-xs text-gray-500">Total Users</p></div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/30"><p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.activeTrials}</p><p className="mt-1 text-xs text-blue-600 dark:text-blue-400">Active Trials</p></div>
              <div className="rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-900 dark:bg-green-950/30"><p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.paying}</p><p className="mt-1 text-xs text-green-600 dark:text-green-400">Paying</p></div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30"><p className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.frozen}</p><p className="mt-1 text-xs text-red-600 dark:text-red-400">Frozen</p></div>
            </div>
            <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-950">
                  <tr><th className="px-4 py-3 font-medium text-gray-600">Email</th><th className="px-4 py-3 font-medium text-gray-600">Name</th><th className="px-4 py-3 font-medium text-gray-600">Plan</th><th className="px-4 py-3 font-medium text-gray-600">Role</th><th className="px-4 py-3 font-medium text-gray-600">Trial Ends</th><th className="px-4 py-3 font-medium text-gray-600">Joined</th><th className="px-4 py-3 font-medium text-gray-600">Ests</th><th className="px-4 py-3 font-medium text-gray-600">Status</th><th className="px-4 py-3 font-medium text-gray-600">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                      <td className="px-4 py-3"><span className="font-medium">{u.email}</span>{u.role === "admin" && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">admin</span>}</td>
                      <td className="px-4 py-3 text-gray-600">{u.name}</td>
                      <td className="px-4 py-3"><span className="capitalize text-gray-700">{tierLabel(u.subscription_tier)}</span></td>
                      <td className="px-4 py-3">
                        <select value={u.role || "user"} onChange={e => handleSetRole(u.id, e.target.value)} className="rounded border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-700 dark:bg-gray-800">
                          <option value="user">User</option><option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(u.trial_ends_at)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3 text-gray-600">{u.estimate_count || 0}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(u.frozen)}`}>{u.frozen === 1 ? "Frozen" : "Active"}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <select value="" onChange={e => { if (e.target.value) handleChangePlan(u.id, e.target.value); }} className="rounded border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-700 dark:bg-gray-800">
                            <option value="">Plan…</option>
                            {PLANS.map(p => <option key={p} value={p} disabled={p === u.subscription_tier}>{tierLabel(p)}{p === u.subscription_tier ? " ✓" : ""}</option>)}
                          </select>
                          <button onClick={() => handleToggleFrozen(u.id, u.frozen)} className="rounded border px-2 py-0.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-700">{u.frozen === 1 ? "Unfreeze" : "Freeze"}</button>
                          <button onClick={() => handleDelete(u.id)} className="rounded border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400">Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">No users found.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Audit Log Tab */}
        {tab === "audit" && (
          <>
            {platformStats && (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div className="rounded-xl border p-4"><p className="text-xl font-bold">{platformStats.totalUsers}</p><p className="text-xs text-gray-500">Users</p></div>
                <div className="rounded-xl border p-4"><p className="text-xl font-bold">{platformStats.totalEstimates}</p><p className="text-xs text-gray-500">Estimates</p></div>
                <div className="rounded-xl border p-4"><p className="text-xl font-bold">${Number(platformStats.totalEstimateValue || 0).toLocaleString()}</p><p className="text-xs text-gray-500">Est. Value</p></div>
                <div className="rounded-xl border p-4"><p className="text-xl font-bold">{platformStats.totalWonJobs}</p><p className="text-xs text-gray-500">Won Jobs</p></div>
                <div className="rounded-xl border p-4"><p className="text-xl font-bold">{platformStats.totalInvoices}</p><p className="text-xs text-gray-500">Invoices</p></div>
              </div>
            )}
            <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-950">
                  <tr><th className="px-4 py-3 font-medium text-gray-600">Time</th><th className="px-4 py-3 font-medium text-gray-600">User</th><th className="px-4 py-3 font-medium text-gray-600">Action</th><th className="px-4 py-3 font-medium text-gray-600">Entity</th><th className="px-4 py-3 font-medium text-gray-600">Details</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {auditLog.map((a: any) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2 text-xs">{a.user_email || "system"}</td>
                      <td className="px-4 py-2 text-xs font-medium">{a.action}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{a.entity_type}{a.entity_id ? ` #${a.entity_id.slice(0,8)}` : ""}</td>
                      <td className="px-4 py-2 text-xs text-gray-400 max-w-xs truncate">{a.details || "—"}</td>
                    </tr>
                  ))}
                  {auditLog.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">No audit entries yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Health Tab */}
        {tab === "health" && (
          <div className="mt-6 space-y-4">
            {health && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className={`rounded-xl border p-5 ${health.db ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <p className="text-sm font-medium">Database</p>
                  <p className={`text-2xl font-bold ${health.db ? "text-green-700" : "text-red-700"}`}>{health.db ? "OK" : "DOWN"}</p>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                  <p className="text-sm font-medium">API</p>
                  <p className="text-2xl font-bold text-green-700">OK</p>
                </div>
                <div className="rounded-xl border p-5">
                  <p className="text-sm font-medium">Uptime</p>
                  <p className="text-2xl font-bold">{Math.floor((health?.uptime || 0) / 60)}m {Math.floor((health?.uptime || 0) % 60)}s</p>
                </div>
              </div>
            )}
            {platformStats && (
              <div className="rounded-xl border p-6">
                <h3 className="font-semibold mb-3">Platform Overview</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Total Users:</span> <strong>{platformStats.totalUsers}</strong></div>
                  <div><span className="text-gray-500">Total Estimates:</span> <strong>{platformStats.totalEstimates}</strong></div>
                  <div><span className="text-gray-500">Estimate Value:</span> <strong>${Number(platformStats.totalEstimateValue || 0).toLocaleString()}</strong></div>
                  <div><span className="text-gray-500">Won Jobs:</span> <strong>{platformStats.totalWonJobs}</strong></div>
                  <div><span className="text-gray-500">Total Invoices:</span> <strong>{platformStats.totalInvoices}</strong></div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
