import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { getCurrentUser } from "~/lib/auth";
import { getTemplates, createEstimateFromTemplate } from "~/lib/templates";

export const Route = createFileRoute("/templates")({
  loader: async () => {
    const { user } = await getCurrentUser();
    if (!user) throw redirect({ to: "/login" });
    const templates = await getTemplates({ data: undefined });
    return { user, templates: templates.templates };
  },
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
  const { user, templates } = Route.useLoaderData();
  const [activeTrade, setActiveTrade] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);

  const trades = [...new Set(templates.map((t: any) => t.trade_type))];
  const filtered = activeTrade === "all" ? templates : templates.filter((t: any) => t.trade_type === activeTrade);

  const handleUseTemplate = async (tpl: any) => {
    setSelectedTemplate(tpl);
    setShowCreate(true);
    setProjectName(tpl.name);
    setCustomerName("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await createEstimateFromTemplate({ data: { templateId: selectedTemplate.id, projectName, customerName } });
      window.location.href = `/estimates/${result.id}`;
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</span>
          <div className="flex items-center gap-6 text-sm font-medium">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Dashboard</Link>
            <Link to="/estimates" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Estimates</Link>
            <span className="text-gray-600 dark:text-gray-400">{user.email}</span>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Estimate Templates</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Pre-built line-item templates by trade. Start from a template and customize.</p>
          </div>
          <Link to="/estimates/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Start from Scratch</Link>
        </div>

        {/* Trade filter tabs */}
        <div className="mt-8 flex flex-wrap gap-2">
          <button onClick={() => setActiveTrade("all")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${activeTrade === "all" ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}>All</button>
          {trades.map((t: any) => (
            <button key={t} onClick={() => setActiveTrade(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${activeTrade === t ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}>{t}</button>
          ))}
        </div>

        {/* Template grid */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tpl: any) => (
            <div key={tpl.id} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tradeColors[tpl.trade_type] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"}`}>{tpl.trade_type}</span>
              <h3 className="mt-3 text-base font-semibold">{tpl.name}</h3>
              {tpl.description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tpl.description}</p>}
              <button
                onClick={() => handleUseTemplate(tpl)}
                className="mt-4 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Use This Template
              </button>
            </div>
          ))}
        </div>

        {/* Create from template modal */}
        {showCreate && selectedTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
              <h2 className="text-lg font-semibold">Create from "{selectedTemplate.name}"</h2>
              <form onSubmit={handleCreate} className="mt-4 space-y-4">
                <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Project Name</label><input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" required /></div>
                <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</label><input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" required /></div>
                <div className="flex gap-3">
                  <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{loading ? "Creating..." : "Create Estimate"}</button>
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