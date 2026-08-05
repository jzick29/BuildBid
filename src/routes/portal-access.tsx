import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/portal-access")({ component: PortalAccessPage });

function PortalAccessPage() {
  const [user, setUser] = useState<any>(null);
  const [clientUsers, setClientUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", companyName: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"ok" | "err">("ok");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const call = (fn: string, data: any = {}) =>
    fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: fn, args: { data } }), credentials: "include" }).then((r) => r.json());

  const fetchData = async () => {
    try {
      const me = await fetch("/api/me", { credentials: "include" }).then((r) => r.json());
      if (!me.user) { window.location.href = "/login"; return; }
      setUser(me.user);
      const d = await call("portalClient.listClientUsers");
      setClientUsers(Array.isArray(d.clientUsers) ? d.clientUsers : []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const loadEstimates = async () => { setEstimates((await call("portalClient.listEstimates")) || []); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || form.password.length < 6) { setMessage("Email and a password of at least 6 characters are required."); setMessageType("err"); return; }
    setSaving(true); setMessage("");
    try {
      const res = await call("portalClient.createClientUser", form);
      if (res.id) {
        setMessage(`Client portal user created. Portal link: ${window.location.origin}/portal — share the email and password with your customer.`);
        setMessageType("ok"); setShowCreate(false); setForm({ email: "", name: "", companyName: "", password: "" }); fetchData();
      } else { setMessage(res.error || "Failed to create portal user"); setMessageType("err"); }
    } catch (err: any) { setMessage(err.message || "Failed to create portal user"); setMessageType("err"); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (cu: any) => { setBusyId(cu.id); try { await call("portalClient.updateClientUser", { id: cu.id, active: cu.active === 1 ? 0 : 1 }); fetchData(); } finally { setBusyId(null); } };
  const handleResetPassword = async (cu: any) => {
    const pw = prompt(`New password for ${cu.email} (min 6 characters):`);
    if (!pw) return;
    if (pw.length < 6) { setMessage("Password must be at least 6 characters."); setMessageType("err"); return; }
    setBusyId(cu.id);
    try { await call("portalClient.resetClientPassword", { id: cu.id, password: pw }); setMessage("Password reset. The client will need to sign in again."); setMessageType("ok"); } finally { setBusyId(null); }
  };
  const handleDelete = async (cu: any) => {
    if (!confirm(`Remove portal access for ${cu.email}? This unlinks all their shared proposals.`)) return;
    setBusyId(cu.id);
    try { await call("portalClient.deleteClientUser", { id: cu.id }); setMessage("Portal user removed."); setMessageType("ok"); fetchData(); } finally { setBusyId(null); }
  };
  const handleLink = async (estimateId: string, clientUserId: string, link: boolean) => {
    setBusyId(estimateId);
    try { await call(link ? "portalClient.linkEstimate" : "portalClient.unlinkEstimate", link ? { estimateId, clientUserId } : { estimateId }); await loadEstimates(); fetchData(); } finally { setBusyId(null); }
  };
  const toggleExpand = async (cu: any) => { if (expanded === cu.id) { setExpanded(null); return; } setExpanded(cu.id); await loadEstimates(); };

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading…</p></div>;
  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client Portal Access</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Give your customers a login at <Link to="/portal" className="text-indigo-600 hover:underline dark:text-indigo-400">{window.location.origin}/portal</Link> to view proposals, sign documents, and approve change orders.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">{showCreate ? "Cancel" : "+ New Portal User"}</button>
      </div>

      {message && <div className={`mt-4 rounded-lg p-3 text-sm ${messageType === "ok" ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"}`}>{message}</div>}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold">New Portal User</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email *</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" placeholder="client@example.com" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Contact name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" placeholder="Jane Smith" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Company name</label>
              <input type="text" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" placeholder="Smith Properties LLC" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Password * (min 6 chars)</label>
              <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" placeholder="••••••••" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? "Creating…" : "Create Portal User"}</button>
        </form>
      )}

      {clientUsers.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700"><p className="text-gray-500">No client portal users yet. Create one to start sharing proposals.</p></div>
      ) : (
        <div className="mt-8 space-y-4">
          {clientUsers.map((cu: any) => (
            <div key={cu.id} className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{cu.name || cu.email}{cu.active !== 1 && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">disabled</span>}</p>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{cu.email}{cu.company_name && ` · ${cu.company_name}`} · {cu.estimate_count} shared proposal{cu.estimate_count === 1 ? "" : "s"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => toggleExpand(cu)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">{expanded === cu.id ? "Hide Proposals" : "Manage Proposals"}</button>
                  <button onClick={() => handleToggleActive(cu)} disabled={busyId === cu.id} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50">{cu.active === 1 ? "Disable" : "Enable"}</button>
                  <button onClick={() => handleResetPassword(cu)} disabled={busyId === cu.id} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50">Reset Password</button>
                  <button onClick={() => handleDelete(cu)} disabled={busyId === cu.id} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50">Remove</button>
                </div>
              </div>
              {expanded === cu.id && (
                <div className="border-t border-gray-200 p-4 dark:border-gray-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Share proposals with {cu.name || cu.email}</p>
                  {estimates.length === 0 ? (
                    <p className="mt-3 text-sm text-gray-500">You don't have any estimates yet.</p>
                  ) : (
                    <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto">
                      {estimates.map((est: any) => {
                        const linked = est.client_user_id === cu.id;
                        return (
                          <label key={est.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950">
                            <span className="min-w-0 truncate">
                              <span className="font-medium text-gray-900 dark:text-gray-100">{est.project_name}</span>
                              <span className="ml-2 text-xs text-gray-400">{est.customer_name} · {est.trade}</span>
                            </span>
                            <input type="checkbox" checked={linked} disabled={busyId === est.id} onChange={() => handleLink(est.id, cu.id, !linked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
