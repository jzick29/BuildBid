import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";

export const Route = createFileRoute("/customers")({
  loader: async () => ({}),
  component: CustomersPage,
});

function CustomersPage() {
  const [user, setUser] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("customer_name");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!d.user) { window.location.href = "/login"; return; }
        setUser(d.user);
        return fetch("/api/call", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ function: "customers.getCustomerList", args: {} }),
          credentials: "include",
        });
      })
      .then(r => r?.json())
      .then(d => { if (d) setCustomers(Array.isArray(d) ? d : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: string) => {
    if (sortKey === key) { setSortDir(s => s === "asc" ? "desc" : "asc"); }
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = useMemo(() => {
    const list = search.trim()
      ? customers.filter((c: any) => (c.customer_name || "").toLowerCase().includes(search.toLowerCase()))
      : customers;
    return [...list].sort((a: any, b: any) => {
      let av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [customers, search, sortKey, sortDir]);

  const handleExpand = async (name: string) => {
    if (expanded === name) { setExpanded(null); return; }
    setExpanded(name);
    setDetailLoading(true);
    try {
      const res = await fetch("/api/call", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "customers.getCustomerList", args: { data: { customer: name } } }),
        credentials: "include",
      });
      const d = await res.json();
      setDetailData(Array.isArray(d) ? d : []);
    } catch { setDetailData([]); }
    finally { setDetailLoading(false); }
  };

  const sortArrow = (key: string) => {
    if (sortKey !== key) return <span className="text-gray-300 ml-1">&varr;</span>;
    return sortDir === "asc" ? <span className="ml-1">&uarr;</span> : <span className="ml-1">&darr;</span>;
  };

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (!user) return null;

  return (
    <div className="flex min-h-dvh flex-col">

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">{customers.length} unique customers</p>

        {/* Search */}
        <div className="mt-6">
          <input type="text" placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-300" onClick={() => handleSort("customer_name")}>
                  Customer {sortArrow("customer_name")}
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700" onClick={() => handleSort("total_estimates")}>
                  Total Bids {sortArrow("total_estimates")}
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700" onClick={() => handleSort("won")}>
                  Won {sortArrow("won")}
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700" onClick={() => handleSort("total_revenue")}>
                  Revenue {sortArrow("total_revenue")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Last Bid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {sorted.map((c: any) => (
                <>
                  <tr key={c.customer_name} className="hover:bg-gray-50 dark:hover:bg-gray-950 cursor-pointer" onClick={() => handleExpand(c.customer_name)}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {c.customer_name}
                      <span className="ml-2 text-xs text-gray-400">{expanded === c.customer_name ? "▲" : "▼"}</span>
                    </td>
                    <td className="px-4 py-3 text-center">{c.total_estimates}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium text-green-600 dark:text-green-400">{c.won}</span>
                      {c.lost > 0 && <span className="ml-1 text-red-500 dark:text-red-400">/ {c.lost} lost</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-medium">${(c.total_revenue || 0).toLocaleString("en-US")}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.last_bid ? new Date(c.last_bid).toLocaleDateString() : "—"}</td>
                  </tr>
                  {expanded === c.customer_name && (
                    <tr key={`${c.customer_name}-detail`} className="bg-gray-50 dark:bg-gray-950">
                      <td colSpan={5} className="px-4 py-4">
                        {detailLoading ? (
                          <p className="text-sm text-gray-400">Loading...</p>
                        ) : detailData?.length > 0 ? (
                          <div>
                            <p className="text-sm font-semibold mb-2">
                              Win/Loss: {c.won}W / {c.lost}L · Win Rate: {c.total_estimates > 0 ? Math.round((c.won / c.total_estimates) * 100) : 0}% · Total Revenue: ${(c.total_revenue || 0).toLocaleString()}
                            </p>
                            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-100 dark:bg-gray-900">
                                  <tr><th className="px-3 py-2 text-left">Project</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-right">Total</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                  {detailData.map((e: any) => (
                                    <tr key={e.id}>
                                      <td className="px-3 py-2">
                                        <Link to="/estimates/$id" params={{ id: e.id }} className="text-indigo-600 hover:text-indigo-500 font-medium">{e.project_name}</Link>
                                      </td>
                                      <td className="px-3 py-2 text-gray-500">{new Date(e.created_at).toLocaleDateString()}</td>
                                      <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                          e.status === "won" ? "bg-green-100 text-green-700" :
                                          e.status === "lost" ? "bg-red-100 text-red-700" :
                                          e.status === "sent" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                                        }`}>{e.status}</span>
                                      </td>
                                      <td className="px-3 py-2 text-right font-medium">${Number(e.total || 0).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">No estimate details available</p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">{customers.length === 0 ? "No customers yet" : "No matching customers"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
