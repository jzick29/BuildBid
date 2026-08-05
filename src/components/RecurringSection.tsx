import { useState, useEffect } from "react";

export default function RecurringSection() {
  const [recurring, setRecurring] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [recName, setRecName] = useState("");
  const [recFreq, setRecFreq] = useState("monthly");
  const [recAmount, setRecAmount] = useState("0");
  const [recNext, setRecNext] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/call", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ function: "recurringInvoices.list", args: {} }),
          credentials: "include",
        });
        const data = await res.json();
        setRecurring(Array.isArray(data) ? data : []);
      } catch (e) {}
      finally { setLoading(false); }
    })();
  }, []);

  const handleAdd = async () => {
    if (!recName.trim() || !recNext || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/call", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "recurringInvoices.create", args: { data: { name: recName.trim(), frequency: recFreq, amount: parseFloat(recAmount) || 0, nextDate: recNext } } }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.id) {
        setRecurring([...recurring, { id: d.id, name: recName.trim(), frequency: recFreq, amount: parseFloat(recAmount) || 0, next_date: recNext, status: "active" }]);
        setShowAdd(false); setRecName(""); setRecAmount("0"); setRecNext("");
      }
    } catch (e: any) { alert("Failed: " + e.message); }
    finally { setAdding(false); }
  };

  const handleDelete = async (riId: string) => {
    if (!confirm("Delete this recurring invoice?")) return;
    try {
      await fetch("/api/call", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "recurringInvoices.delete", args: { data: { id: riId } } }),
        credentials: "include",
      });
      setRecurring(recurring.filter(r => r.id !== riId));
    } catch (e: any) { alert("Failed: " + e.message); }
  };

  const handleToggle = async (riId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    try {
      await fetch("/api/call", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "recurringInvoices.update", args: { data: { id: riId, status: newStatus } } }),
        credentials: "include",
      });
      setRecurring(recurring.map(r => r.id === riId ? { ...r, status: newStatus } : r));
    } catch (e: any) { alert("Failed: " + e.message); }
  };

  if (loading) return null;

  const freqs: Record<string, string> = { weekly: "Weekly", biweekly: "Biweekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Recurring Invoices</h2>
        <button onClick={() => setShowAdd(true)} className="rounded-lg border border-dashed border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950">
          + Add Recurring
        </button>
      </div>
      {recurring.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">No recurring invoices configured.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {recurring.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800">
              <div>
                <p className="font-medium text-sm">{r.name}</p>
                <p className="text-xs text-gray-500">
                  {freqs[r.frequency] || r.frequency} · ${Number(r.amount || 0).toFixed(2)} · Next: {r.next_date ? new Date(r.next_date).toLocaleDateString() : "\u2014"}
                  {r.project_name && <span> · {r.project_name}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                  {r.status}
                </span>
                <button onClick={() => handleToggle(r.id, r.status)} className="text-xs text-indigo-600 hover:text-indigo-500">
                  {r.status === "active" ? "Pause" : "Resume"}
                </button>
                <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Recurring Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !adding && setShowAdd(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">New Recurring Invoice</h3>
            <div className="mt-4 space-y-3">
              <input value={recName} onChange={e => setRecName(e.target.value)} placeholder="Name (e.g., Monthly Maintenance)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
              <select value={recFreq} onChange={e => setRecFreq(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                <option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
              </select>
              <input type="number" value={recAmount} onChange={e => setRecAmount(e.target.value)} placeholder="Amount" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
              <input type="date" value={recNext} onChange={e => setRecNext(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleAdd} disabled={adding || !recName.trim() || !recNext} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
