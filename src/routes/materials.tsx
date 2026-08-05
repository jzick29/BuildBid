import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { BulkImport } from "~/components/BulkImport";

export const Route = createFileRoute("/materials")({ component: MaterialsPage });

function MaterialsPage() {
  const [user, setUser] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & filter
  const [search, setSearch] = useState("");
  const [activeTrade, setActiveTrade] = useState("all");
  const [activeCategory, setActiveCategory] = useState("all");

  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTrade, setBulkTrade] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkSupplier, setBulkSupplier] = useState("");
  const [bulkCost, setBulkCost] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Modal (edit/create)
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formUnit, setFormUnit] = useState("each");
  const [formCost, setFormCost] = useState("0");
  const [formTrade, setFormTrade] = useState("general");
  const [formCategory, setFormCategory] = useState("");
  const [formSupplier, setFormSupplier] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formQty, setFormQty] = useState("0");
  const [formReorder, setFormReorder] = useState("0");
  const [formRestock, setFormRestock] = useState("0");
  const [saving, setSaving] = useState(false);

  // Price history panel
  const [priceHistId, setPriceHistId] = useState<string | null>(null);
  const [priceHist, setPriceHist] = useState<any[]>([]);

  // Supplier modal
  const [showSuppModal, setShowSuppModal] = useState(false);
  const [suppForm, setSuppForm] = useState({ name: "", contact_name: "", email: "", phone: "", website: "", notes: "", editingId: "" });

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        const meData = await meRes.json();
        if (!meData.user) { window.location.href = "/login"; return; }
        setUser(meData.user);
        const [m, s] = await Promise.all([
          fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "materials.listMaterials", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []),
          fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "suppliers.list", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []),
        ]);
        setMaterials(Array.isArray(m) ? m : []);
        setSuppliers(Array.isArray(s) ? s : []);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const refresh = async () => {
    const [m, s] = await Promise.all([
      fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "materials.listMaterials", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []),
      fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "suppliers.list", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []),
    ]);
    setMaterials(Array.isArray(m) ? m : []);
    setSuppliers(Array.isArray(s) ? s : []);
  };

  const callApi = async (fn: string, data: any) => {
    const res = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: fn, args: { data } }), credentials: "include" });
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    return result;
  };

  const trades = [...new Set(materials.map((m: any) => m.trade).filter(Boolean))];
  const categories = [...new Set(materials.map((m: any) => m.category).filter(Boolean))];

  const filtered = useMemo(() => {
    let list = materials;
    if (activeTrade !== "all") list = list.filter((m: any) => m.trade === activeTrade);
    if (activeCategory !== "all") list = list.filter((m: any) => m.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m: any) => (m.name || "").toLowerCase().includes(q) || (m.supplier || "").toLowerCase().includes(q) || (m.supplier_name || "").toLowerCase().includes(q) || (m.category || "").toLowerCase().includes(q));
    }
    return list;
  }, [materials, activeTrade, activeCategory, search]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) { setSelected(new Set()); }
    else { setSelected(new Set(filtered.map((m: any) => m.id))); }
  };

  const handleBulkApply = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const updates: any = {};
    if (bulkTrade) updates.trade = bulkTrade;
    if (bulkCategory) updates.category = bulkCategory;
    if (bulkSupplier) updates.supplier_id = bulkSupplier;
    if (bulkCost) updates.unit_cost = bulkCost;
    if (Object.keys(updates).length === 0) { alert("Nothing to update"); return; }
    try {
      await callApi("materials.bulkUpdate", { ids, updates });
      await refresh();
      setSelected(new Set());
      setShowBulk(false);
      setBulkTrade(""); setBulkCategory(""); setBulkSupplier(""); setBulkCost("");
    } catch (e: any) { alert("Bulk update failed: " + e.message); }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected materials?`)) return;
    try {
      await callApi("materials.bulkDelete", { ids });
      await refresh();
      setSelected(new Set());
    } catch (e: any) { alert("Bulk delete failed: " + e.message); }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormName(""); setFormDesc(""); setFormUnit("each"); setFormCost("0");
    setFormTrade("general"); setFormCategory(""); setFormSupplier(""); setFormSupplierId("");
    setFormQty("0"); setFormReorder("0"); setFormRestock("0");
    setShowModal(true);
  };

  const openEdit = (m: any) => {
    setEditingId(m.id);
    setFormName(m.name || ""); setFormDesc(m.description || ""); setFormUnit(m.unit || "each");
    setFormCost(String(m.unit_cost || 0)); setFormTrade(m.trade || "general");
    setFormCategory(m.category || ""); setFormSupplier(m.supplier || "");
    setFormSupplierId(m.supplier_id || ""); setFormQty(String(m.inventory_qty || 0));
    setFormReorder(String(m.reorder_point || 0)); setFormRestock(String(m.restock_qty || 0));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: formName.trim(), description: formDesc, unit: formUnit, unit_cost: formCost,
        trade: formTrade, category: formCategory, supplier: formSupplier,
        supplier_id: formSupplierId || null, inventory_qty: formQty, reorder_point: formReorder, restock_qty: formRestock,
      };
      if (editingId) {
        await callApi("materials.updateMaterial", { ...data, id: editingId });
      } else {
        await callApi("materials.createMaterial", data);
      }
      await refresh();
      setShowModal(false);
    } catch (e: any) { alert("Save failed: " + e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this material?")) return;
    try { await callApi("materials.deleteMaterial", { id }); await refresh(); }
    catch (e: any) { alert("Delete failed: " + e.message); }
  };

  const loadPriceHistory = async (mid: string) => {
    setPriceHistId(mid);
    try {
      const h = await callApi("materials.getPriceHistory", { materialId: mid });
      setPriceHist(Array.isArray(h) ? h : []);
    } catch (e) {}
  };

  const handleSaveSupplier = async () => {
    if (!suppForm.name.trim()) return;
    try {
      if (suppForm.editingId) {
        await callApi("suppliers.update", { ...suppForm, id: suppForm.editingId });
      } else {
        await callApi("suppliers.create", suppForm);
      }
      setShowSuppModal(false);
      setSuppForm({ name: "", contact_name: "", email: "", phone: "", website: "", notes: "", editingId: "" });
      await refresh();
    } catch (e: any) { alert("Failed: " + e.message); }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm("Delete this supplier?")) return;
    try { await callApi("suppliers.delete", { id }); await refresh(); }
    catch (e: any) { alert("Failed: " + e.message); }
  };

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">Error: {error}</p></div>;
  if (!user) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Materials</h1>
          <div className="flex gap-2">
            <button onClick={() => { setSuppForm({ name: "", contact_name: "", email: "", phone: "", website: "", notes: "", editingId: "" }); setShowSuppModal(true); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              + Supplier
            </button>
            <button onClick={() => setShowImport(!showImport)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              📄 Import
            </button>
            <button onClick={openCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              + Material
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input type="text" placeholder="Search materials..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm flex-1 min-w-[200px] max-w-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          <select value={activeTrade} onChange={e => setActiveTrade(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            <option value="all">All Trades</option>
            {trades.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={activeCategory} onChange={e => setActiveCategory(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {(search || activeTrade !== "all" || activeCategory !== "all") && (
            <button onClick={() => { setSearch(""); setActiveTrade("all"); setActiveCategory("all"); }}
              className="text-xs text-indigo-600 hover:text-indigo-500">Clear</button>
          )}
        </div>

        {/* Bulk Import */}
        {showImport && (
          <div className="mt-6 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">📦 Bulk Import from Supplier</h3>
              <button onClick={() => setShowImport(false)} className="text-sm text-gray-500 hover:text-gray-700">✕ Close</button>
            </div>
            <BulkImport onImported={(r) => {
              refresh();
              setShowImport(false);
            }} />
          </div>
        )}

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="mt-4 rounded-lg bg-indigo-50 dark:bg-indigo-950 p-3 flex items-center gap-3 text-sm">
            <span className="font-medium">{selected.size} selected</span>
            {!showBulk ? (
              <>
                <button onClick={() => setShowBulk(true)} className="text-indigo-600 hover:text-indigo-500 font-medium">Bulk Edit</button>
                <button onClick={handleBulkDelete} className="text-red-600 hover:text-red-500 font-medium">Delete Selected</button>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input type="text" placeholder="New cost" value={bulkCost} onChange={e => setBulkCost(e.target.value)}
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" />
                <select value={bulkTrade} onChange={e => setBulkTrade(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800">
                  <option value="">Trade</option>
                  {trades.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="text" placeholder="Category" value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" />
                <select value={bulkSupplier} onChange={e => setBulkSupplier(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800">
                  <option value="">Supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={handleBulkApply} className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700">Apply</button>
                <button onClick={() => { setShowBulk(false); setBulkTrade(""); setBulkCategory(""); setBulkSupplier(""); setBulkCost(""); }}
                  className="text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            )}
          </div>
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
            <p className="text-gray-500">No materials found</p>
            <button onClick={openCreate} className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-500">Add your first material</button>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-3 py-3 w-10"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll} className="rounded" /></th>
                  <th className="px-3 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-500">Category</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-500">Trade</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-500">Cost</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-500">Unit</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-500">Qty</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-500">Supplier</th>
                  <th className="px-3 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filtered.map((m: any) => (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                    <td className="px-3 py-2"><input type="checkbox" checked={selected.has(m.id)}
                      onChange={() => toggleSelect(m.id)} className="rounded" /></td>
                    <td className="px-3 py-2 font-medium">
                      <span className="cursor-pointer text-indigo-600 hover:text-indigo-500" onClick={() => loadPriceHistory(m.id)}>{m.name}</span>
                      {m.description && <p className="text-xs text-gray-400">{m.description}</p>}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{m.category || "—"}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400 capitalize">{m.trade || "—"}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">${Number(m.unit_cost || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-gray-500">{m.unit}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={Number(m.inventory_qty) <= Number(m.reorder_point) && Number(m.reorder_point) > 0 ? "text-amber-600 font-medium" : ""}>
                        {m.inventory_qty || 0}
                      </span>
                      {Number(m.inventory_qty) <= Number(m.reorder_point) && Number(m.reorder_point) > 0 && (
                        <span className="ml-1 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-400">Low</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{m.supplier_name || m.supplier || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(m)} className="text-xs text-indigo-600 hover:text-indigo-500">Edit</button>
                        <button onClick={() => handleDelete(m.id)} className="text-xs text-red-500 hover:text-red-700">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Price History Panel */}
        {priceHistId && (
          <div className="mt-6 rounded-xl border border-gray-200 p-5 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">Price History</h3>
              <button onClick={() => { setPriceHistId(null); setPriceHist([]); }} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>
            {priceHist.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">No price changes recorded.</p>
            ) : (
              <table className="mt-2 w-full text-sm">
                <thead><tr><th className="text-left text-gray-500 py-1">Date</th><th className="text-right text-gray-500 py-1">Old Cost</th><th className="text-right text-gray-500 py-1">New Cost</th><th className="text-right text-gray-500 py-1">Change</th></tr></thead>
                <tbody>
                  {priceHist.map((h: any) => (
                    <tr key={h.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="py-1 text-gray-600 dark:text-gray-400">{new Date(h.changed_at).toLocaleDateString()}</td>
                      <td className="text-right">${Number(h.old_cost).toFixed(2)}</td>
                      <td className="text-right">${Number(h.new_cost).toFixed(2)}</td>
                      <td className={`text-right ${h.new_cost > h.old_cost ? "text-red-600" : h.new_cost < h.old_cost ? "text-green-600" : ""}`}>
                        {h.new_cost > h.old_cost ? "+" : ""}{Number(h.new_cost - h.old_cost).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Supplier list */}
        <div className="mt-10">
          <h2 className="text-xl font-bold tracking-tight mb-3">Suppliers</h2>
          {suppliers.length === 0 ? (
            <p className="text-sm text-gray-400">No suppliers yet.</p>
          ) : (
            <div className="space-y-2">
              {suppliers.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-gray-500">
                      {[s.contact_name, s.email, s.phone].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setSuppForm({ name: s.name, contact_name: s.contact_name, email: s.email, phone: s.phone, website: s.website, notes: s.notes, editingId: s.id }); setShowSuppModal(true); }}
                      className="text-xs text-indigo-600 hover:text-indigo-500">Edit</button>
                    <button onClick={() => handleDeleteSupplier(s.id)} className="text-xs text-red-500 hover:text-red-700">Del</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Edit/Create Material Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !saving && setShowModal(false)}>
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{editingId ? "Edit Material" : "New Material"}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <input value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Unit Cost</label>
                <input type="number" step="0.01" value={formCost} onChange={e => setFormCost(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
                <select value={formUnit} onChange={e => setFormUnit(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                  <option value="each">each</option><option value="ft">ft</option><option value="sqft">sqft</option>
                  <option value="lb">lb</option><option value="hr">hr</option><option value="roll">roll</option>
                  <option value="gallon">gallon</option><option value="box">box</option><option value="set">set</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Trade</label>
                <select value={formTrade} onChange={e => setFormTrade(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                  <option value="general">General</option><option value="electrical">Electrical</option><option value="plumbing">Plumbing</option>
                  <option value="hvac">HVAC</option><option value="roofing">Roofing</option><option value="carpentry">Carpentry</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                <input value={formCategory} onChange={e => setFormCategory(e.target.value)} placeholder="e.g. Rough-in, Fixtures" className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Supplier</label>
                <select value={formSupplierId} onChange={e => setFormSupplierId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                  <option value="">None</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Supplier (text)</label>
                <input value={formSupplier} onChange={e => setFormSupplier(e.target.value)} placeholder="Manual entry" className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
              </div>

              {/* Inventory */}
              <div className="col-span-2 border-t pt-3 mt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Inventory</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">On Hand</label>
                    <input type="number" min="0" value={formQty} onChange={e => setFormQty(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Reorder At</label>
                    <input type="number" min="0" value={formReorder} onChange={e => setFormReorder(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Restock Qty</label>
                    <input type="number" min="0" value={formRestock} onChange={e => setFormRestock(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} disabled={saving} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving || !formName.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {showSuppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSuppModal(false)}>
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{suppForm.editingId ? "Edit Supplier" : "New Supplier"}</h3>
            <div className="mt-4 space-y-3 text-sm">
              <input value={suppForm.name} onChange={e => setSuppForm({ ...suppForm, name: e.target.value })} placeholder="Name *" className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
              <input value={suppForm.contact_name} onChange={e => setSuppForm({ ...suppForm, contact_name: e.target.value })} placeholder="Contact Name" className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
              <input value={suppForm.email} onChange={e => setSuppForm({ ...suppForm, email: e.target.value })} placeholder="Email" className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
              <input value={suppForm.phone} onChange={e => setSuppForm({ ...suppForm, phone: e.target.value })} placeholder="Phone" className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
              <input value={suppForm.website} onChange={e => setSuppForm({ ...suppForm, website: e.target.value })} placeholder="Website" className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
              <textarea value={suppForm.notes} onChange={e => setSuppForm({ ...suppForm, notes: e.target.value })} placeholder="Notes" rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowSuppModal(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleSaveSupplier} disabled={!suppForm.name.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {suppForm.editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
