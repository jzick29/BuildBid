import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";

export const Route = createFileRoute("/invoices")({ component: InvoicesPage });

function InvoicesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  // Create invoice modal
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        const meData = await meRes.json();
        if (!meData.user) { window.location.href = "/login"; return; }
        setUser(meData.user);

        const [invRes, estRes] = await Promise.all([
          fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "invoices.listInvoices", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []),
          fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "estimates.listEstimates", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => ({ estimates: [] })),
        ]);

        setInvoices(Array.isArray(invRes) ? invRes : []);
        setEstimates((estRes?.estimates || []).filter((e: any) => e.status === "won"));
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleCreateInvoice = async () => {
    if (!selectedEstimate || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: "invoices.createInvoice",
          args: { data: { estimateId: selectedEstimate, dueDate: dueDate || undefined, notes: notes || undefined } },
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.id) {
        // Refresh list
        const invRes = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "invoices.listInvoices", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []);
        setInvoices(Array.isArray(invRes) ? invRes : []);
        setShowCreate(false);
        setSelectedEstimate("");
        setDueDate("");
        setNotes("");
      } else {
        alert("Failed: " + (data.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    if (filterStatus === "All") return invoices;
    return invoices.filter((inv: any) => inv.status === filterStatus.toLowerCase());
  }, [invoices, filterStatus]);

  const totalSum = filteredInvoices.reduce((s: number, inv: any) => s + (parseFloat(inv.total) || 0), 0);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      paid: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
      sent: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
      overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
      draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    };
    return map[status] || map.draft;
  };

  const tabs = ["All", "Draft", "Sent", "Paid", "Overdue"];

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">Error: {error}</p></div>;
  if (!user) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Create Invoice
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="mt-6 flex gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
          {tabs.map(tab => {
            const count = tab === "All" ? invoices.length : invoices.filter((i: any) => i.status === tab.toLowerCase()).length;
            return (
              <button
                key={tab}
                onClick={() => setFilterStatus(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  filterStatus === tab
                    ? "text-indigo-600 border-b-2 border-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {tab} ({count})
              </button>
            );
          })}
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
            <p className="text-gray-500">No {filterStatus === "All" ? "" : filterStatus.toLowerCase()} invoices</p>
            {filterStatus === "All" && (
              <button onClick={() => setShowCreate(true)} className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                Create your first invoice
              </button>
            )}
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Invoice #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Project</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredInvoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                    <td className="px-4 py-3 font-medium">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{inv.project_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{inv.customer_name || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">${Number(inv.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge(inv.status || "draft")}`}>
                        {inv.status || "draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
                  <td colSpan={3} className="px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                    {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-gray-100">
                    ${totalSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </main>

      {/* Create Invoice Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !creating && setShowCreate(false)}>
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create Invoice</h3>
              <button onClick={() => !creating && setShowCreate(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estimate</label>
                <select
                  value={selectedEstimate}
                  onChange={e => setSelectedEstimate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">Select a won estimate...</option>
                  {estimates.map((e: any) => (
                    <option key={e.id} value={e.id}>
                      {e.project_name} — {e.customer_name} (${Number(e.total || 0).toFixed(2)})
                    </option>
                  ))}
                </select>
                {estimates.length === 0 && (
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">No won estimates available. Mark an estimate as won first.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Payment terms, special instructions..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  rows={3}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreate(false)}
                disabled={creating}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={!selectedEstimate || creating}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
