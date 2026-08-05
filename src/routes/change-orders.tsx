import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";

export const Route = createFileRoute("/change-orders")({ component: ChangeOrdersPage });

function ChangeOrdersPage() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [coEstimate, setCoEstimate] = useState("");
  const [coTitle, setCoTitle] = useState("");
  const [coDesc, setCoDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Template modal
  const [showTmpl, setShowTmpl] = useState(false);
  const [tmplName, setTmplName] = useState("");
  const [tmplDesc, setTmplDesc] = useState("");
  const [tmplTrade, setTmplTrade] = useState("general");
  const [savingTmpl, setSavingTmpl] = useState(false);

  const loadData = async () => {
    const [coRes, tmplRes, estRes] = await Promise.all([
      fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "changeOrders.list", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []),
      fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "changeOrders.listTemplates", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []),
      fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "estimates.listEstimates", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => ({ estimates: [] })),
    ]);
    setOrders(Array.isArray(coRes) ? coRes : []);
    setTemplates(Array.isArray(tmplRes) ? tmplRes : []);
    setEstimates((estRes?.estimates || []).filter((e: any) => e.status === "won"));
  };

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      if (!meData.user) { window.location.href = "/login"; return; }
      setUser(meData.user);
      await loadData();
      setLoading(false);
    })();
  }, []);

  const callApi = async (fn: string, data: any) => {
    const res = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: fn, args: { data } }), credentials: "include" });
    const r = await res.json();
    if (r.error) throw new Error(r.error);
    return r;
  };

  const handleCreate = async () => {
    if (!coEstimate || !coTitle.trim()) return;
    setCreating(true);
    try { await callApi("changeOrders.create", { estimateId: coEstimate, title: coTitle.trim(), description: coDesc }); setShowCreate(false); setCoTitle(""); setCoDesc(""); setCoEstimate(""); await loadData(); }
    catch (e: any) { alert(e.message); }
    finally { setCreating(false); }
  };

  const handleSaveTemplate = async () => {
    if (!tmplName.trim()) return;
    setSavingTmpl(true);
    try { await callApi("changeOrders.saveTemplate", { name: tmplName.trim(), description: tmplDesc, trade: tmplTrade, items: [] }); setShowTmpl(false); setTmplName(""); setTmplDesc(""); await loadData(); }
    catch (e: any) { alert(e.message); }
    finally { setSavingTmpl(false); }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try { await callApi("changeOrders.deleteTemplate", { id }); await loadData(); }
    catch (e: any) { alert(e.message); }
  };

  const filtered = useMemo(() => {
    let list = orders;
    if (filterStatus !== "all") list = list.filter((o: any) => o.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o: any) => (o.title || "").toLowerCase().includes(q) || (o.project_name || "").toLowerCase().includes(q));
    }
    return list;
  }, [orders, filterStatus, search]);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      draft: "bg-gray-100 text-gray-700", submitted: "bg-blue-100 text-blue-700",
      approved: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700",
    };
    return map[s] || map.draft;
  };

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (!user) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Change Orders</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowTmpl(true)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">+ Template</button>
            <button onClick={() => setShowCreate(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">+ Change Order</button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 flex gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
          {["all", "draft", "submitted", "approved", "rejected"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize ${filterStatus === s ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-500 hover:text-gray-700"}`}>
              {s} ({s === "all" ? orders.length : orders.filter((o: any) => o.status === s).length})
            </button>
          ))}
        </div>
        <div className="mt-3">
          <input type="text" placeholder="Search change orders..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
            <p className="text-gray-500">No change orders</p>
            <button onClick={() => setShowCreate(true)} className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-500">Create your first change order</button>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Project</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Cost</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filtered.map((co: any) => (
                  <tr key={co.id} className="hover:bg-gray-50 dark:hover:bg-gray-950 cursor-pointer" onClick={() => window.location.href = `/change-orders/${co.id}`}>
                    <td className="px-4 py-3 font-medium">{co.title}</td>
                    <td className="px-4 py-3 text-gray-500">{co.project_name || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">${Number(co.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge(co.status)}`}>{co.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{co.created_at ? new Date(co.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Templates */}
        <div className="mt-10">
          <h2 className="text-xl font-bold tracking-tight mb-3">Templates</h2>
          {templates.length === 0 ? (
            <p className="text-sm text-gray-400">No templates yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((t: any) => (
                <div key={t.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <p className="font-medium">{t.name}</p>
                  {t.description && <p className="text-xs text-gray-500 mt-1">{t.description}</p>}
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => handleDeleteTemplate(t.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create CO Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !creating && setShowCreate(false)}>
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">New Change Order</h3>
            <div className="mt-4 space-y-3">
              <select value={coEstimate} onChange={e => setCoEstimate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                <option value="">Select won estimate...</option>
                {estimates.map((e: any) => <option key={e.id} value={e.id}>{e.project_name} — ${Number(e.total||0).toFixed(2)}</option>)}
              </select>
              <input value={coTitle} onChange={e => setCoTitle(e.target.value)} placeholder="Title *" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
              <textarea value={coDesc} onChange={e => setCoDesc(e.target.value)} placeholder="Description" rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleCreate} disabled={creating || !coEstimate || !coTitle.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{creating ? "Creating..." : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTmpl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !savingTmpl && setShowTmpl(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">New Template</h3>
            <div className="mt-4 space-y-3">
              <input value={tmplName} onChange={e => setTmplName(e.target.value)} placeholder="Name *" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
              <input value={tmplDesc} onChange={e => setTmplDesc(e.target.value)} placeholder="Description" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
              <select value={tmplTrade} onChange={e => setTmplTrade(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                <option value="general">General</option><option value="electrical">Electrical</option><option value="plumbing">Plumbing</option><option value="hvac">HVAC</option><option value="roofing">Roofing</option>
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowTmpl(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleSaveTemplate} disabled={savingTmpl || !tmplName.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{savingTmpl ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
