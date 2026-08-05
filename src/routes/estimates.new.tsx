import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AiEstimator } from "../components/AiEstimator";

export const Route = createFileRoute("/estimates/new")({
  loader: async () => ({}),
  component: NewEstimate,
});

const TRADES = ["electrical", "plumbing", "hvac", "roofing", "general", "other"];

const tradeColors: Record<string, string> = {
  electrical: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  plumbing: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  hvac: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  roofing: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  general: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
};

function NewEstimate() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [existingCount, setExistingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [trade, setTrade] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"blank" | "template" | "ai">("blank");
  const [materials, setMaterials] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!d.user) { window.location.href = "/login"; return; }
        setUser(d.user);
        return Promise.all([
          fetch("/api/call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ function: "templates.getTemplates", args: {} }),
            credentials: "include",
          }).then(r => r.json()),
          fetch("/api/call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ function: "estimates.listEstimates", args: {} }),
            credentials: "include",
          }).then(r => r.json()),
        ]);
      })
      .then(([tplData, estData]) => {
        if (tplData?.templates) setTemplates(tplData.templates);
        if (estData?.estimates) setExistingCount(estData.estimates.length);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(""); setSubmitting(true);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "estimates.createEstimate", args: { data: { projectName, customerName, trade } } }),
        credentials: "include",
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      if (existingCount === 0 && typeof window !== "undefined") {
        (window as any).__buildbidTrack?.("trial_started");
      }
      router.navigate({ to: `/estimates/${result.id}` });
    } catch (err: any) { setFormError(err.message || "Failed"); } finally { setSubmitting(false); }
  };

  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) { setFormError("Please select a template"); return; }
    setFormError(""); setSubmitting(true);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "templates.createEstimateFromTemplate", args: { data: { templateId: selectedTemplate, projectName, customerName } } }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      if (existingCount === 0 && typeof window !== "undefined") {
        (window as any).__buildbidTrack?.("trial_started");
      }
      router.navigate({ to: `/estimates/${d.id}` });
    } catch (err: any) { setFormError(err.message || "Failed"); } finally { setSubmitting(false); }
  };

  const filteredTemplates = templates.filter((t: any) => !trade || t.trade_type === trade);

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">{error}</p></div>;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link to="/estimates" className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">&larr; Back to estimates</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">New Estimate</h1>

      <div className="mt-6 flex gap-2 rounded-lg border border-gray-200 p-1 dark:border-gray-800">
        <button onClick={() => setMode("blank")} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium ${mode === "blank" ? "bg-indigo-600 text-white" : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"}`}>Start from Scratch</button>
        <button onClick={() => setMode("template")} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium ${mode === "template" ? "bg-indigo-600 text-white" : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"}`}>Start from Template</button>
        <button onClick={() => setMode("ai")} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium ${mode === "ai" ? "bg-violet-600 text-white" : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"}`}>✨ AI Estimate</button>
      </div>

      {formError && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">{formError}</div>}

      <div className="mt-8">
        <div>
          {mode === "ai" ? (
            <AiEstimator />
          ) : mode === "blank" ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Project Name</label><input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" required /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</label><input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" required /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Trade</label><select value={trade} onChange={e => setTrade(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" required><option value="">Select trade...</option>{TRADES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></div>
              <button type="submit" disabled={submitting} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? "Creating..." : "Create Estimate"}</button>
            </form>
          ) : (
            <form onSubmit={handleTemplateSubmit} className="space-y-6">
              <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Project Name</label><input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" required /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</label><input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" required /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Trade</label><select value={trade} onChange={e => { setTrade(e.target.value); setSelectedTemplate(""); }} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"><option value="">All trades</option>{TRADES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></div>
              <div>
                <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">Choose a Template</label>
                {filteredTemplates.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No templates found for this trade.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {filteredTemplates.map((t: any) => (
                      <button key={t.id} type="button" onClick={() => setSelectedTemplate(t.id)} className={`rounded-xl border p-4 text-left transition-all ${selectedTemplate === t.id ? "border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800" : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"}`}>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tradeColors[t.trade_type] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"}`}>
                          {t.trade_type.charAt(0).toUpperCase() + t.trade_type.slice(1)}
                        </span>
                        <h3 className="mt-2 text-sm font-semibold">{t.name}</h3>
                        {t.description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{t.description}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" disabled={submitting || !selectedTemplate} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? "Creating..." : "Create from Template"}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
