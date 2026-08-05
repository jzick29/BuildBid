import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";

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

const TRADES = ["electrical", "plumbing", "hvac", "roofing", "general", "other"];

function TemplatesPage() {
  const [user, setUser] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "my" | "shared">("all");
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

  // Edit mode
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [editItems, setEditItems] = useState<any[]>([]);

  // Share
  const [shareUrl, setShareUrl] = useState("");
  const [shareError, setShareError] = useState("");

  // Publish to Marketplace
  const [publishTemplate, setPublishTemplate] = useState<any>(null);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishDesc, setPublishDesc] = useState("");
  const [publishTrade, setPublishTrade] = useState("");
  const [publishTags, setPublishTags] = useState("");
  const [publishPrice, setPublishPrice] = useState("0");
  const [publishError, setPublishError] = useState("");
  const [publishDone, setPublishDone] = useState("");
  const [publishListingId, setPublishListingId] = useState("");
  const [publishing, setPublishing] = useState(false);

  // Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importError, setImportError] = useState("");

  const loadTemplates = async (tab: string = activeTab) => {
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "templates.getTemplates", args: { data: { tab } } }),
        credentials: "include",
      });
      const d = await res.json();
      if (d?.templates) setTemplates(d.templates);
    } catch (e: any) { setError(e.message); }
  };

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!d.user) { window.location.href = "/login"; return; }
        setUser(d.user);
        return loadTemplates();
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const switchTab = (tab: "all" | "my" | "shared") => {
    setActiveTab(tab);
    setActiveTrade("all");
    loadTemplates(tab);
  };

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
      if (d?.items) setPreviewItems(d.items || []);
    } catch { setPreviewItems([]); } finally { setPreviewLoading(false); }
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "templates.createEstimateFromTemplate", args: { data: { templateId: selectedTemplate.id, projectName, customerName } } }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      window.location.href = "/estimates/" + d.id;
    } catch (err: any) { alert(err.message); } finally { setCreating(false); }
  };

  // Edit mode
  const startEdit = async (tpl: any) => {
    const res = await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "templates.getTemplate", args: { data: { id: tpl.id } } }),
      credentials: "include",
    });
    const d = await res.json();
    setEditingTemplate(d.template || tpl);
    setEditItems(d.items || []);
  };

  const saveEdit = async () => {
    if (!editingTemplate) return;
    await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "templates.updateTemplate", args: { data: { id: editingTemplate.id, name: editingTemplate.name, description: editingTemplate.description, trade_type: editingTemplate.trade_type } } }),
      credentials: "include",
    });
    setEditingTemplate(null);
    setEditItems([]);
    loadTemplates();
  };

  const updateEditItem = async (itemId: string, changes: any) => {
    await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "templates.updateTemplateItem", args: { data: { id: itemId, ...changes } } }),
      credentials: "include",
    });
  };

  const addEditItem = async () => {
    if (!editingTemplate) return;
    const res = await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "templates.addTemplateItem", args: { data: { templateId: editingTemplate.id, description: "New Item", quantity: 1, unit: "each", unitCost: 0, markupPercent: 10 } } }),
      credentials: "include",
    });
    if (res.ok) {
      const tres = await fetch("/api/call", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "templates.getTemplate", args: { data: { id: editingTemplate.id } } }),
        credentials: "include",
      });
      const d = await tres.json();
      if (d?.items) setEditItems(d.items);
    }
  };

  const removeEditItem = async (itemId: string) => {
    await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "templates.removeTemplateItem", args: { data: { id: itemId } } }),
      credentials: "include",
    });
    setEditItems(prev => prev.filter(i => i.id !== itemId));
  };

  const deleteTemplate = async (tpl: any) => {
    if (!confirm("Delete template \"" + tpl.name + "\"?")) return;
    await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "templates.deleteTemplate", args: { data: { id: tpl.id } } }),
      credentials: "include",
    });
    loadTemplates();
  };

  // Share
  const handleShare = async (tpl: any) => {
    setShareError("");
    const res = await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "templates.shareTemplate", args: { data: { templateId: tpl.id } } }),
      credentials: "include",
    });
    const d = await res.json();
    if (d.error) { setShareError(d.error); return; }
    setShareUrl(d.url);
    try { await navigator.clipboard.writeText(d.url); } catch {}
  };

  // Publish to Marketplace
  const openPublish = (tpl: any) => {
    setPublishTemplate(tpl);
    setPublishTitle(tpl.name);
    setPublishDesc(tpl.description || "");
    setPublishTrade(tpl.trade_type || "general");
    setPublishTags("");
    setPublishPrice("0");
    setPublishError("");
    setPublishDone("");
    setPublishListingId("");
  };

  const submitPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishing(true); setPublishError(""); setPublishDone("");
    try {
      const res = await fetch("/api/call", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "templates.publish", args: { data: { templateId: publishTemplate.id, title: publishTitle, description: publishDesc, trade: publishTrade, tags: publishTags, price: parseFloat(publishPrice) || 0 } } }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.error) { setPublishError(d.error); return; }
      setPublishListingId(d.listingId);
      setPublishDone("Published! Your listing is now live in the marketplace.");
    } catch (err: any) { setPublishError(err.message); }
    finally { setPublishing(false); }
  };

  // Export
  const handleExport = async (tpl: any) => {
    const res = await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "templates.getTemplate", args: { data: { id: tpl.id } } }),
      credentials: "include",
    });
    const d = await res.json();
    const blob = new Blob([JSON.stringify({ template: d.template, items: d.items }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (tpl.name || "template").replace(/\s+/g, "-").toLowerCase() + ".json";
    a.click();
  };

  // Import
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError("");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json.template || !json.items) throw new Error("Invalid format");
      setImportPreview(json);
    } catch (err: any) {
      setImportError("Invalid template file: " + err.message);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "templates.saveCustomTemplate", args: { data: { name: importPreview.template.name + " (Imported)", description: importPreview.template.description, trade_type: importPreview.template.trade_type, items: importPreview.items } } }),
      credentials: "include",
    });
    setImportPreview(null);
    loadTemplates();
  };

  const calcTotal = (item: any) => (item.quantity * item.unit_cost) * (1 + item.markup_percent / 100);

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">{error}</p></div>;
  if (!user) return null;

  const isCustom = (tpl: any) => tpl.user_id === user.id;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Estimate Templates</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Pre-built line-item templates by trade. Start from a template and customize.</p>
          </div>
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Import</button>
            <Link to="/templates/marketplace" className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950">Marketplace</Link>
            <Link to="/estimates/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Start from Scratch</Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 rounded-lg border border-gray-200 p-1 dark:border-gray-800 w-fit">
          {(["all", "my", "shared"] as const).map(tab => (
            <button key={tab} onClick={() => switchTab(tab)} className={`rounded-md px-4 py-1.5 text-sm font-medium ${activeTab === tab ? "bg-indigo-600 text-white" : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"}`}>
              {tab === "all" ? "All Templates" : tab === "my" ? "My Templates" : "Shared with Me"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mt-4">
          <input type="text" placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
        </div>

        {/* Trade filter */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setActiveTrade("all")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${activeTrade === "all" ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}>All</button>
          {trades.map((t: any) => (
            <button key={t} onClick={() => setActiveTrade(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${activeTrade === t ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}>{t}</button>
          ))}
        </div>

        {/* Import Preview */}
        {importPreview && (
          <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-800 dark:bg-indigo-950/30">
            <h3 className="font-semibold text-lg">Import Template</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{importPreview.template.name} — {importPreview.items.length} items</p>
            <div className="mt-3 flex gap-2">
              <button onClick={confirmImport} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Confirm Import</button>
              <button onClick={() => setImportPreview(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">Cancel</button>
            </div>
          </div>
        )}

        {importError && <p className="mt-3 text-sm text-red-500">{importError}</p>}

        {/* Templates Grid */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tpl: any) => (
            <div key={tpl.id} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tradeColors[tpl.trade_type] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"}`}>{tpl.trade_type}</span>
                <div className="flex items-center gap-2">
                  {isCustom(tpl) && <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-full px-2 py-0.5">Yours</span>}
                  {tpl.item_count ? <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">{tpl.item_count} items</span> : null}
                </div>
              </div>
              <h3 className="mt-3 text-base font-semibold">{tpl.name}</h3>
              {tpl.description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tpl.description}</p>}
              <div className="mt-4 flex gap-2 flex-wrap">
                <button onClick={() => handlePreview(tpl)} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900">Preview</button>
                <button onClick={() => handleUseTemplate(tpl)} className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Use</button>
              </div>
              {/* Custom template actions */}
              {isCustom(tpl) && (
                <div className="mt-2 flex gap-1 flex-wrap">
                  <button onClick={() => startEdit(tpl)} className="text-xs text-indigo-600 hover:text-indigo-500 px-2 py-1">Edit</button>
                  <button onClick={() => handleShare(tpl)} className="text-xs text-indigo-600 hover:text-indigo-500 px-2 py-1">Share</button>
                  <button onClick={() => openPublish(tpl)} className="text-xs text-green-600 hover:text-green-500 px-2 py-1">Publish</button>
                  <button onClick={() => handleExport(tpl)} className="text-xs text-indigo-600 hover:text-indigo-500 px-2 py-1">Export</button>
                  <button onClick={() => deleteTemplate(tpl)} className="text-xs text-red-500 hover:text-red-400 px-2 py-1">Delete</button>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-400">
              {activeTab === "my" ? "No custom templates yet. Save an estimate as a template to get started." :
               activeTab === "shared" ? "No shared templates." :
               "No templates found."}
            </div>
          )}
        </div>

        {/* Share result */}
        {shareUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShareUrl("")}>
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold">Share Link</h3>
              <p className="text-sm text-gray-500 mt-1">Copied to clipboard!</p>
              <input readOnly value={shareUrl} className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
              <button onClick={() => setShareUrl("")} className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Done</button>
            </div>
          </div>
        )}

        {/* Edit Template Modal */}
        {editingTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { saveEdit(); }}>
            <div className="mx-4 w-full max-w-3xl rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold">Edit Template</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Name</label>
                  <input value={editingTemplate.name} onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Trade</label>
                  <select value={editingTemplate.trade_type} onChange={e => setEditingTemplate({...editingTemplate, trade_type: e.target.value})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                    {TRADES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className="text-xs font-medium text-gray-500">Description</label>
                <input value={editingTemplate.description || ""} onChange={e => setEditingTemplate({...editingTemplate, description: e.target.value})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Line Items</h4>
                  <button onClick={addEditItem} className="text-xs text-indigo-600 hover:text-indigo-500 font-medium">+ Add Item</button>
                </div>
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-950">
                      <tr><th className="px-2 py-1 text-left font-medium text-gray-500">Description</th><th className="px-2 py-1 text-right font-medium text-gray-500 w-14">Qty</th><th className="px-2 py-1 font-medium text-gray-500 w-14">Unit</th><th className="px-2 py-1 text-right font-medium text-gray-500 w-20">Cost</th><th className="px-2 py-1 text-right font-medium text-gray-500 w-14">Mk%</th><th className="px-2 py-1 w-8"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {editItems.map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-2 py-1"><input value={item.description} onChange={e => { setEditItems(prev => prev.map(i => i.id === item.id ? {...i, description: e.target.value} : i)); updateEditItem(item.id, {description: e.target.value}); }} className="w-full rounded border border-gray-200 px-1 py-0.5 text-sm dark:border-gray-700 dark:bg-gray-800" /></td>
                          <td className="px-2 py-1"><input type="number" value={item.quantity} onChange={e => { setEditItems(prev => prev.map(i => i.id === item.id ? {...i, quantity: parseFloat(e.target.value)||1} : i)); updateEditItem(item.id, {quantity: parseFloat(e.target.value)||1}); }} className="w-full rounded border border-gray-200 px-1 py-0.5 text-sm text-right dark:border-gray-700 dark:bg-gray-800" /></td>
                          <td className="px-2 py-1"><input value={item.unit} onChange={e => { setEditItems(prev => prev.map(i => i.id === item.id ? {...i, unit: e.target.value} : i)); updateEditItem(item.id, {unit: e.target.value}); }} className="w-full rounded border border-gray-200 px-1 py-0.5 text-sm dark:border-gray-700 dark:bg-gray-800" /></td>
                          <td className="px-2 py-1"><input type="number" step="0.01" value={item.unit_cost} onChange={e => { setEditItems(prev => prev.map(i => i.id === item.id ? {...i, unit_cost: parseFloat(e.target.value)||0} : i)); updateEditItem(item.id, {unitCost: parseFloat(e.target.value)||0}); }} className="w-full rounded border border-gray-200 px-1 py-0.5 text-sm text-right dark:border-gray-700 dark:bg-gray-800" /></td>
                          <td className="px-2 py-1"><input type="number" value={item.markup_percent} onChange={e => { setEditItems(prev => prev.map(i => i.id === item.id ? {...i, markup_percent: parseFloat(e.target.value)||0} : i)); updateEditItem(item.id, {markupPercent: parseFloat(e.target.value)||0}); }} className="w-full rounded border border-gray-200 px-1 py-0.5 text-sm text-right dark:border-gray-700 dark:bg-gray-800" /></td>
                          <td className="px-2 py-1 text-center"><button onClick={() => removeEditItem(item.id)} className="text-xs text-red-500 hover:text-red-400">&times;</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button onClick={() => { setEditingTemplate(null); setEditItems([]); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">Cancel</button>
                <button onClick={saveEdit} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Template Preview Modal */}
        {showPreview && previewTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPreview(false)}>
            <div className="mx-4 w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{previewTemplate.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{previewTemplate.trade_type} &middot; {previewItems.length} line items</p>
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
              <h2 className="text-lg font-semibold">Create from &ldquo;{selectedTemplate.name}&rdquo;</h2>
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
        {/* Publish to Marketplace Modal */}
        {publishTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Publish to Marketplace</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">&ldquo;{publishTemplate.name}&rdquo; — share it with other contractors</p>
                </div>
                <button onClick={() => setPublishTemplate(null)} className="text-gray-400 hover:text-gray-600"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <form onSubmit={submitPublish} className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Listing Title</label>
                  <input type="text" value={publishTitle} onChange={e => setPublishTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" required maxLength={120} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                  <textarea value={publishDesc} onChange={e => setPublishDesc(e.target.value)} rows={3} placeholder="What jobs is this template for? What's included?" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Trade</label>
                    <select value={publishTrade} onChange={e => setPublishTrade(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                      {TRADES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Price (USD)</label>
                    <input type="number" min="0" step="0.01" value={publishPrice} onChange={e => setPublishPrice(e.target.value)} placeholder="0 = free" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" />
                    <p className="mt-1 text-[11px] text-gray-400">Free or $4.99–$49.99. You keep 80% of sales.</p>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tags <span className="text-gray-400">(comma separated)</span></label>
                  <input type="text" value={publishTags} onChange={e => setPublishTags(e.target.value)} placeholder="residential, new-construction, panel-upgrade" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" />
                </div>
                {publishError && <p className="text-sm text-red-500">{publishError}</p>}
                {publishDone && (
                  <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <p>{publishDone}</p>
                    <Link to={`/templates/marketplace/${publishListingId}`} className="mt-1 inline-block underline">View your listing →</Link>
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="submit" disabled={publishing || !!publishDone} className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">{publishing ? "Publishing..." : "Publish"}</button>
                  <button type="button" onClick={() => setPublishTemplate(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900">Done</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
