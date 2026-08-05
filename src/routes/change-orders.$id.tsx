import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";

export const Route = createFileRoute("/change-orders/$id")({ component: ChangeOrderDetailPage });

function ChangeOrderDetailPage() {
  const router = useRouter();
  const params = Route.useParams() as { id: string } | undefined;
  const id = params?.id;
  if (!id) return null;
  const [user, setUser] = useState<any>(null);
  const [co, setCo] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit items
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<any[]>([]);

  // Cost diff
  const [costDiff, setCostDiff] = useState<any>(null);

  // Reject
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const callApi = async (fn: string, data: any) => {
    const res = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: fn, args: { data } }), credentials: "include" });
    const r = await res.json();
    if (r.error) throw new Error(r.error);
    return r;
  };

  const load = useCallback(async () => {
    try {
      const data = await callApi("changeOrders.get", { id });
      setCo(data); setItems(data.items || []); setHistory(data.history || []);
      setEditItems((data.items || []).map((it: any) => ({ ...it, _changed: false })));
      try { const diff = await callApi("changeOrders.getCostDiff", { id }); setCostDiff(diff); } catch (e) {}
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      if (!meData.user) { window.location.href = "/login"; return; }
      setUser(meData.user);
      await load();
    })();
  }, [load]);

  const handleAction = async (action: string, extra: any = {}) => {
    try {
      await callApi("changeOrders." + action, { id, ...extra });
      await load();
    } catch (e: any) { alert("Failed: " + e.message); }
  };

  const handleSaveItems = async () => {
    try {
      await callApi("changeOrders.saveItems", { changeOrderId: id, items: editItems.map(({ _changed, ...rest }: any) => rest) });
      await load();
      setEditing(false);
    } catch (e: any) { alert("Failed: " + e.message); }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      draft: "bg-gray-100 text-gray-700", submitted: "bg-blue-100 text-blue-700",
      approved: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700",
    };
    return map[s] || map.draft;
  };

  const canEdit = co?.status === "draft";

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center flex-col gap-4"><p className="text-red-500">{error}</p><Link to="/change-orders" className="text-indigo-600 hover:underline">← Back</Link></div>;
  if (!user || !co) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <Link to="/change-orders" className="text-sm text-gray-500 hover:text-gray-700">← Change Orders</Link>
        <div className="flex items-center justify-between flex-wrap gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{co.title}</h1>
            <p className="text-gray-500 text-sm">{co.project_name} — {co.customer_name}</p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium capitalize ${statusBadge(co.status)}`}>{co.status}</span>
        </div>

        {/* Description & Cost Diff */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {co.description && (
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Description</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">{co.description}</p>
            </div>
          )}
          {costDiff && (
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Cost Impact</h3>
              <div className="flex gap-6 text-sm">
                <div><span className="text-gray-500">Estimate:</span> <span className="font-medium">${Number(costDiff.estimateTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                <div><span className="text-gray-500">Change:</span> <span className="font-medium">${Number(costDiff.changeTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                <div><span className="text-gray-500">Diff:</span> <span className={`font-bold ${costDiff.difference > 0 ? "text-red-600" : costDiff.difference < 0 ? "text-green-600" : ""}`}>{costDiff.difference >= 0 ? "+" : ""}{Number(costDiff.difference).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({costDiff.percentChange}%)</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Approval Actions */}
        <div className="mt-6 flex flex-wrap gap-2">
          {co.status === "draft" && (
            <>
              <button onClick={() => handleAction("submit")} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Submit for Approval</button>
              <button onClick={() => setEditing(!editing)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
                {editing ? "Cancel Editing" : "Edit Items"}
              </button>
            </>
          )}
          {co.status === "submitted" && (
            <>
              <button onClick={() => handleAction("approve")} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">Approve</button>
              <button onClick={() => setShowReject(true)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Reject</button>
            </>
          )}
          {co.status !== "draft" && co.status !== "submitted" && (
            <p className="text-sm text-gray-400 italic">This change order has been {co.status}.</p>
          )}
        </div>

        {/* Reject Modal */}
        {showReject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowReject(false)}>
            <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold">Reject Change Order</h3>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection..." rows={3}
                className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
              <div className="mt-4 flex justify-end gap-3">
                <button onClick={() => setShowReject(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
                <button onClick={async () => { await handleAction("reject", { reason: rejectReason }); setShowReject(false); setRejectReason(""); }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Reject</button>
              </div>
            </div>
          </div>
        )}

        {/* Line Items */}
        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800">
          <h3 className="p-4 text-sm font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">Line Items</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-950">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Description</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500 w-16">Qty</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 w-16">Unit</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500 w-20">Rate</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500 w-14">Mkup%</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500 w-24">Total</th>
                {editing && <th className="px-4 py-2 w-8"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {(editing ? editItems : items).map((it: any, i: number) => {
                const lineTotal = (it.quantity || 1) * (it.unit_cost || 0) * (1 + (it.markup_percent || 0) / 100);
                return (
                  <tr key={it.id || i}>
                    <td className="px-4 py-2">{editing ? <input value={it.description} onChange={e => { const c = [...editItems]; c[i] = { ...c[i], description: e.target.value, _changed: true }; setEditItems(c); }} className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" /> : it.description}</td>
                    <td className="px-4 py-2 text-right">{editing ? <input type="number" value={it.quantity} onChange={e => { const c = [...editItems]; c[i] = { ...c[i], quantity: parseFloat(e.target.value) || 0, _changed: true }; setEditItems(c); }} className="w-full text-right rounded border border-gray-300 px-1 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" /> : it.quantity}</td>
                    <td className="px-4 py-2">{editing ? <input value={it.unit} onChange={e => { const c = [...editItems]; c[i] = { ...c[i], unit: e.target.value, _changed: true }; setEditItems(c); }} className="w-full rounded border border-gray-300 px-1 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" /> : it.unit}</td>
                    <td className="px-4 py-2 text-right">{editing ? <input type="number" step="0.01" value={it.unit_cost} onChange={e => { const c = [...editItems]; c[i] = { ...c[i], unit_cost: parseFloat(e.target.value) || 0, _changed: true }; setEditItems(c); }} className="w-full text-right rounded border border-gray-300 px-1 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" /> : "$" + Number(it.unit_cost || 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{editing ? <input type="number" step="0.1" value={it.markup_percent} onChange={e => { const c = [...editItems]; c[i] = { ...c[i], markup_percent: parseFloat(e.target.value) || 0, _changed: true }; setEditItems(c); }} className="w-full text-right rounded border border-gray-300 px-1 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" /> : it.markup_percent + "%"}</td>
                    <td className="px-4 py-2 text-right font-medium">${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    {editing && <td className="px-1"><button onClick={() => setEditItems(editItems.filter((_: any, j: number) => j !== i))} className="text-red-500 text-xs">✕</button></td>}
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={editing ? 7 : 6} className="px-4 py-8 text-center text-gray-400">No line items</td></tr>}
            </tbody>
          </table>
          {editing && (
            <div className="p-4 border-t flex gap-2">
              <button onClick={() => setEditItems([...editItems, { id: "new-" + Date.now(), description: "", quantity: 1, unit: "each", unit_cost: 0, markup_percent: 0, _changed: true }])}
                className="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400">+ Add Item</button>
              <button onClick={handleSaveItems} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Save Items</button>
            </div>
          )}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="mt-6 rounded-xl border border-gray-200 p-5 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">History</h3>
            <div className="space-y-2 text-sm">
              {history.map((h: any) => (
                <div key={h.id} className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-2 last:border-0">
                  <div>
                    <span className="font-medium capitalize">{h.action.replace(/_/g, " ")}</span>
                    {h.old_status && <span className="text-gray-400">: {h.old_status} → {h.new_status}</span>}
                    {h.comment && <p className="text-xs text-gray-500 mt-0.5">{h.comment}</p>}
                  </div>
                  <span className="text-gray-400 text-xs whitespace-nowrap">{new Date(h.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
