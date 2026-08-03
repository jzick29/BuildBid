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
  const [filter, setFilter] = useState<"all"|"active"|"expiring"|"expired">("all");

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        const meData = await meRes.json();
        if (!meData.user) { window.location.href = "/login"; return; }
        setUser(meData.user);
        const [c, e] = await Promise.all([
          fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "contracts.listContracts", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []),
          fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "contracts.getExpiringContracts", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []),
        ]);
        setContracts(Array.isArray(c) ? c : []);
        setExpiring(Array.isArray(e) ? e : []);
      } catch (err: any) { setError(err.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const getIsExpiring = (c: any) => {
    if (c.status !== "active") return false;
    const expires = expiring.find((e: any) => e.id === c.id);
    return !!expires;
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
  }), [contracts, expiring]);

  const filterTabs: { key: typeof filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "expiring", label: "Expiring" },
    { key: "expired", label: "Expired" },
  ];

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">Error: {error}</p></div>;
  if (!user) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between"><h1 className="text-3xl font-bold tracking-tight">Contracts</h1></div>
        {expiring.length > 0 && <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/30"><p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">{expiring.length} contract{expiring.length>1?"s":""} expiring soon</p></div>}

        {/* Status Filter Tabs */}
        <div className="mt-6 flex gap-2">
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
                          c.status === "expired" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {c.status}
                          {exp && <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500" title="Expiring soon"></span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{c.next_visit_date ? new Date(c.next_visit_date).toLocaleDateString() : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
