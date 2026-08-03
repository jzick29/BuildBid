import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";

export const Route = createFileRoute("/templates")({
  loader: async () => ({}),
  component: TemplatesPage,
});

const tradeColors: Record<string, string> = {
  electrical: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  plumbing: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  hvac: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  roofing: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  general: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
};

function TemplatesPage() {
  const [user, setUser] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTrade, setActiveTrade] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [creating, setCreating] = useState(false);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!d.user) { window.location.href = "/login"; return; }
        setUser(d.user);
        return fetch("/api/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ function: "templates.getTemplates", args: {} }),
          credentials: "include",
        });
      })
      .then(r => r?.json())
      .then(d => { if (d?.templates) setTemplates(d.templates); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const trades = [...new Set(templates.map((t: any) => t.trade_type))];

  const filtered = useMemo(() => {
    let list = activeTrade === "all" ? templates : templates.filter((t: any) => t.trade_type === activeTrade);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t: any) =>
        (t.name || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [templates, activeTrade, search]);

  const handlePreview = async (tpl: any) => {
    setPreviewTemplate(tpl);
    setPreviewLoading(true);
    setShowPreview(true);
    try {
      const res = await fetch("/api/call", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "templates.getTemplate", args: { data: { id: tpl.id } } }),
        credentials: "include",
      });
      const d = await res.json();
      if (d?.items) {
        setPreviewItems(d.items || []);
        if (d.items.length > 0 && !usageCounts[tpl.id]) {
          // Try to get usage count from templates list
          const count = tpl.usage_count;
          if (count !== undefined) setUsageCounts(prev => ({ ...prev, [tpl.id]: count }));
        }
      }
    } catch {
      setPreviewItems([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleUseTemplate = (tpl: any) => {
    setSelectedTemplate(tpl);
    setShowCreate(true);
    setProjectName(tpl.name);
    setCustomerName("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "templates.createEstimateFromTemplate", args: { data: { templateId: selectedTemplate.id, projectName, customerName } } }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      window.location.href = "/estimates/" + d.id;
    } catch (err: any) { alert(err.message); } finally { setCreating(false); }
  };

  const calcTotal = (item: any) => (item.quantity * item.unit_cost) * (1 + item.markup_percent / 100);

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">{error}</p></div>;
  if (!user) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Estimate Templates</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Pre-built line-item templates by trade. Start from a template and customize.</p>
          </div>
          <Link to="/estimates/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Start from Scratch</Link>
        </div>

        {/* Search */}
        <div className="mt-6">
          <input
            type="text" placeholder="Search templates..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setActiveTrade("all")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${activeTrade === "all" ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}>All</button>
          {trades.map((t: any) => (
            <button key={t} onClick={() => setActiveTrade(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${activeTrade === t ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}>{t}</button>
          ))}
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tpl: any) => (
            <div key={tpl.id} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tradeColors[tpl.trade_type] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"}`}>{tpl.trade_type}</span>
                <div className="flex items-center gap-2">
                  {tpl.item_count ? <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">{tpl.item_count} items</span> : null}
                  {tpl.usage_count > 0 && <span className="text-xs text-gray-400 dark:text-gray-500">Used {tpl.usage_count}x</span>}
                </div>
              </div>
              <h3 className="mt-3 text-base font-semibold">{tpl.name}</h3>
              {tpl.description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tpl.description}</p>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => handlePreview(tpl)} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900">Preview</button>
                <button onClick={() => handleUseTemplate(tpl)} className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Use</button>
              </div>
            </div>
          ))}
        </div>

        {/* Template Preview Modal */}
        {showPreview && previewTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPreview(false)}>
            <div className="mx-4 w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{previewTemplate.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{previewTemplate.trade_type} · {previewItems.length} line items</p>
                </div>
                <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {previewLoading ? (
                <p className="mt-6 text-center text-gray-400">Loading items...</p>
              ) : previewItems.length === 0 ? (
                <p className="mt-6 text-center text-gray-400">No line items</p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-950">
                      <tr><th className="px-3 py-2 text-left font-medium text-gray-500">Description</th><th className="px-3 py-2 text-right font-medium text-gray-500">Qty</th><th className="px-3 py-2 font-medium text-gray-500">Unit</th><th className="px-3 py-2 text-right font-medium text-gray-500">Unit Cost</th><th className="px-3 py-2 text-right font-medium text-gray-500">Markup</th><th className="px-3 py-2 text-right font-medium text-gray-500">Total</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {previewItems.map((item: any, i: number) => (
                        <tr key={i}>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2">{item.unit}</td>
                          <td className="px-3 py-2 text-right">${Number(item.unit_cost).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{item.markup_percent}%</td>
                          <td className="px-3 py-2 text-right font-medium">${calcTotal(item).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-950">
                      <tr><td colSpan={5} className="px-3 py-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Total</td><td className="px-3 py-2 text-right font-bold text-indigo-600 dark:text-indigo-400">${previewItems.reduce((s: number, i: any) => s + calcTotal(i), 0).toFixed(2)}</td></tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <div className="mt-4 flex gap-2 justify-end">
                <button onClick={() => setShowPreview(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">Close</button>
                <button onClick={() => { setShowPreview(false); handleUseTemplate(previewTemplate); }} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Use This Template</button>
              </div>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreate && selectedTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
              <h2 className="text-lg font-semibold">Create from "{selectedTemplate.name}"</h2>
              <form onSubmit={handleCreate} className="mt-4 space-y-4">
                <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Project Name</label><input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" required /></div>
                <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</label><input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" required /></div>
                <div className="flex gap-3">
                  <button type="submit" disabled={creating} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{creating ? "Creating..." : "Create Estimate"}</button>
                  <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
