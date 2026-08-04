import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";

export const Route = createFileRoute("/contracts")({ component: ContractsPage });

function ContractsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [expiring, setExpiring] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all"|"active"|"expiring"|"expired"|"cancelled">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_name: "", project_name: "", trade: "", frequency: "quarterly", start_date: "", end_date: "", amount: "", scope_of_work: "", auto_renew: false });
  const [customers, setCustomers] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      if (!meData.user) { window.location.href = "/login"; return; }
      setUser(meData.user);
      const [c, e, cust] = await Promise.all([
        fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "contracts.list", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []),
        fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "contracts.getExpiringContracts", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []),
        fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "customers.list", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []),
      ]);
      setContracts(Array.isArray(c) ? c : []);
      setExpiring(Array.isArray(e) ? e : []);
      setCustomers(Array.isArray(cust) ? cust : []);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const getIsExpiring = (c: any) => {
    if (c.status !== "active") return false;
    return expiring.some((e: any) => e.id === c.id);
  };

  const filtered = useMemo(() => {
    if (filter === "all") return contracts;
    if (filter === "expiring") return contracts.filter((c: any) => getIsExpiring(c));
    return contracts.filter((c: any) => c.status === filter);
  }, [contracts, filter, expiring]);

  const counts = useMemo(() => ({
    all: contracts.length,
    active: contracts.filter((c: any) => c.status === "active").length,
    expiring: contracts.filter((c: any) => getIsExpiring(c)).length,
    expired: contracts.filter((c: any) => c.status === "expired").length,
    cancelled: contracts.filter((c: any) => c.status === "cancelled").length,
  }), [contracts, expiring]);

  const filterTabs: { key: typeof filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "expiring", label: "Expiring" },
    { key: "expired", label: "Expired" },
    { key: "cancelled", label: "Cancelled" },
  ];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/call", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "contracts.create", args: { data: { ...form, amount: parseFloat(form.amount) || 0 } } }),
        credentials: "include",
      });
      setShowCreate(false);
      setForm({ customer_name: "", project_name: "", trade: "", frequency: "quarterly", start_date: "", end_date: "", amount: "", scope_of_work: "", auto_renew: false });
      fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contract?")) return;
    await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "contracts.delete", args: { data: { id } } }), credentials: "include" });
    fetchData();
  };

  const handleStatus = async (id: string, status: string) => {
    await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "contracts.updateContractStatus", args: { data: { id, status } } }), credentials: "include" });
    fetchData();
  };

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">Error: {error}</p></div>;
  if (!user) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Contracts</h1>
          <button onClick={() => setShowCreate(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">New Contract</button>
        </div>
        {expiring.length > 0 && <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/30"><p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">{expiring.length} contract{expiring.length>1?"s":""} expiring within 30 days</p></div>}

        <div className="mt-6 flex gap-2 flex-wrap">
          {filterTabs.map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${filter === tab.key ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}>
              {tab.label} <span className="ml-1 opacity-60">({counts[tab.key]})</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700"><p className="text-gray-500">{contracts.length === 0 ? "No contracts yet" : "No matching contracts"}</p></div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Project</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Trade</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Frequency</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Next Visit</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filtered.map((c: any) => {
                  const exp = getIsExpiring(c);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                      <td className="px-4 py-3 font-medium">
                        <Link to="/contracts/$id" params={{ id: c.id }} className="text-indigo-600 hover:text-indigo-500">{c.customer_name}</Link>
                      </td>
                      <td className="px-4 py-3">{c.project_name}</td>
                      <td className="px-4 py-3 capitalize text-gray-500">{c.trade || "—"}</td>
                      <td className="px-4 py-3 capitalize">{c.frequency}</td>
                      <td className="px-4 py-3 text-right">${Number(c.amount||0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          c.status === "active" ? "bg-green-100 text-green-700" :
                          c.status === "expired" ? "bg-red-100 text-red-700" :
                          c.status === "cancelled" ? "bg-gray-100 text-gray-600" : "bg-gray-100 text-gray-600"
                        }`}>
                          {c.status}
                          {exp && <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500" title="Expiring soon"></span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{c.next_visit_date ? new Date(c.next_visit_date).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleStatus(c.id, c.status === "active" ? "expired" : "active")} className="text-xs text-gray-500 hover:text-gray-700">{c.status === "active" ? "Expire" : "Renew"}</button>
                          <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:text-red-700">Del</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="mx-4 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">New Contract</h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</label>
                <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" required list="customer-list" />
                <datalist id="customer-list">{customers.map((cu: any) => <option key={cu.id} value={cu.name} />)}</datalist>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Project Name</label>
                  <input value={form.project_name} onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Trade</label>
                  <select value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                    <option value="">Select...</option>
                    <option value="electrical">Electrical</option>
                    <option value="hvac">HVAC</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="roofing">Roofing</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Frequency</label>
                  <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="biannual">Biannual</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Amount ($)</label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Scope of Work</label>
                <textarea value={form.scope_of_work} onChange={e => setForm(f => ({ ...f, scope_of_work: e.target.value }))} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.auto_renew} onChange={e => setForm(f => ({ ...f, auto_renew: e.target.checked }))} className="rounded" />
                Auto-renew
              </label>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? "Creating..." : "Create Contract"}</button>
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
