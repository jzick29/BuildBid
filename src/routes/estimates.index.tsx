import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";

export const Route = createFileRoute("/estimates/")({
  component: EstimatesIndex,
});

function EstimatesIndex() {
  const [user, setUser] = useState<any>(null);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Search & filters
  const [search, setSearch] = useState("");
  const [filterTrade, setFilterTrade] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  // Sort
  const [sortField, setSortField] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Bulk
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!d.user) { window.location.href = "/login"; return; }
        setUser(d.user);
        return fetch("/api/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ function: "estimates.listEstimates", args: {} }),
          credentials: "include",
        });
      })
      .then(r => r?.json())
      .then(d => { if (d?.estimates) setEstimates(d.estimates); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Unique trades for dropdown
  const trades = useMemo(() => {
    const set = new Set<string>();
    estimates.forEach((e: any) => { if (e.trade) set.add(e.trade); });
    return Array.from(set).sort();
  }, [estimates]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this estimate?")) return;
    setDeleting(id);
    await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "estimates.deleteEstimate", args: { data: { id } } }),
      credentials: "include",
    });
    setEstimates(prev => prev.filter(e => e.id !== id));
    setDeleting(null);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortIndicator = (field: string) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">⇅</span>;
    return sortDir === "asc" ? <span className="text-indigo-500 ml-1">↑</span> : <span className="text-indigo-500 ml-1">↓</span>;
  };

  // Bulk select
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredEstimates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredEstimates.map((e: any) => e.id)));
    }
  };

  const handleBulkStatus = async (status: string) => {
    if (selected.size === 0) return;
    setBulkUpdating(true);
    try {
      await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: "estimates.updateEstimateStatus",
          args: { data: { ids: Array.from(selected), status } },
        }),
        credentials: "include",
      });
      setEstimates(prev => prev.map(e => selected.has(e.id) ? { ...e, status } : e));
      setSelected(new Set());
    } catch (e: any) {
      alert("Failed: " + (e.message || "Unknown error"));
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} estimate(s)? This cannot be undone.`)) return;
    setBulkUpdating(true);
    try {
      await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: "estimates.bulkDelete",
          args: { data: { ids: Array.from(selected) } },
        }),
        credentials: "include",
      });
      const idSet = new Set(selected);
      setEstimates(prev => prev.filter(e => !idSet.has(e.id)));
      setSelected(new Set());
    } catch (e: any) {
      alert("Failed: " + (e.message || "Unknown error"));
    } finally {
      setBulkUpdating(false);
    }
  };

  // Filtered & sorted
  const filteredEstimates = useMemo(() => {
    let list = estimates;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e: any) =>
        (e.project_name || "").toLowerCase().includes(q) ||
        (e.customer_name || "").toLowerCase().includes(q)
      );
    }
    if (filterTrade !== "All") {
      list = list.filter((e: any) => e.trade === filterTrade);
    }
    if (filterStatus !== "All") {
      list = list.filter((e: any) => e.status === filterStatus.toLowerCase());
    }
    if (sortField) {
      list = [...list].sort((a: any, b: any) => {
        let va: any, vb: any;
        switch (sortField) {
          case "project": va = a.project_name; vb = b.project_name; break;
          case "customer": va = a.customer_name; vb = b.customer_name; break;
          case "total": va = parseFloat(a.total) || 0; vb = parseFloat(b.total) || 0; break;
          case "status": va = a.status; vb = b.status; break;
          default: return 0;
        }
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [estimates, search, filterTrade, filterStatus, sortField, sortDir]);

  const totalSum = filteredEstimates.reduce((s: number, e: any) => s + (parseFloat(e.total) || 0), 0);

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">{error}</p></div>;
  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Estimates</h1>
        <Link to="/estimates/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">New Estimate</Link>
      </div>

      {estimates.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">No estimates yet.</p>
          <Link to="/estimates/new" className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">Create your first estimate</Link>
        </div>
      ) : (
        <>
          {/* Search / Filter bar */}
          <div className="mt-8 flex flex-wrap gap-4 items-center">
            <input
              type="text"
              placeholder="Search project or customer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            />
            <select
              value={filterTrade}
              onChange={e => setFilterTrade(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="All">All Trades</option>
              {trades.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-950/30">
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{selected.size} selected</span>
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => handleBulkStatus("sent")}
                  disabled={bulkUpdating}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Mark Sent
                </button>
                <button
                  onClick={() => handleBulkStatus("won")}
                  disabled={bulkUpdating}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Mark Won
                </button>
                <button
                  onClick={() => handleBulkStatus("lost")}
                  disabled={bulkUpdating}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Mark Lost
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkUpdating}
                  className="rounded-md bg-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === filteredEstimates.length && filteredEstimates.length > 0}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 cursor-pointer select-none hover:text-indigo-600" onClick={() => handleSort("project")}>
                    Project{sortIndicator("project")}
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 cursor-pointer select-none hover:text-indigo-600" onClick={() => handleSort("customer")}>
                    Customer{sortIndicator("customer")}
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Trade</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 cursor-pointer select-none hover:text-indigo-600" onClick={() => handleSort("status")}>
                    Status{sortIndicator("status")}
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-right cursor-pointer select-none hover:text-indigo-600" onClick={() => handleSort("total")}>
                    Total{sortIndicator("total")}
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredEstimates.map((e: any) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggleSelect(e.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3"><Link to={`/estimates/${e.id}`} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">{e.project_name}</Link></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{e.customer_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 capitalize">{e.trade}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        e.status === 'won' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' :
                        e.status === 'lost' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' :
                        e.status === 'sent' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                      }`}>{e.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">${Number(e.total || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right"><button onClick={() => handleDelete(e.id)} disabled={deleting === e.id} className="text-xs text-red-600 hover:text-red-500 disabled:opacity-50">Delete</button></td>
                  </tr>
                ))}
              </tbody>
              {/* Total row */}
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
                  <td colSpan={5} className="px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                    {filteredEstimates.length} estimate{filteredEstimates.length !== 1 ? "s" : ""} · ${totalSum.toLocaleString(undefined, { minimumFractionDigits: 2 })} total
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-gray-100">
                    ${totalSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
