import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";

export const Route = createFileRoute("/materials")({ component: MaterialsPage });

function MaterialsPage() {
  const [user, setUser] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & filter
  const [search, setSearch] = useState("");
  const [activeTrade, setActiveTrade] = useState("all");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formUnit, setFormUnit] = useState("each");
  const [formCost, setFormCost] = useState("0");
  const [formTrade, setFormTrade] = useState("general");
  const [formSupplier, setFormSupplier] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        const meData = await meRes.json();
        if (!meData.user) { window.location.href = "/login"; return; }
        setUser(meData.user);
        const m = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "materials.listMaterials", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []);
        setMaterials(Array.isArray(m) ? m : []);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const refresh = async () => {
    const m = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "materials.listMaterials", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []);
    setMaterials(Array.isArray(m) ? m : []);
  };

  const trades = [...new Set(materials.map((m: any) => m.trade).filter(Boolean))];
  const filtered = useMemo(() => {
    let list = materials;
    if (activeTrade !== "all") list = list.filter((m: any) => m.trade === activeTrade);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m: any) => (m.name || "").toLowerCase().includes(q) || (m.supplier || "").toLowerCase().includes(q));
    }
    return list;
  }, [materials, activeTrade, search]);

  const openCreate = () => {
    setEditingId(null);
    setFormName(""); setFormUnit("each"); setFormCost("0");
    setFormTrade("general"); setFormSupplier("");
    setShowModal(true);
  };

  const openEdit = (m: any) => {
    setEditingId(m.id);
    setFormName(m.name); setFormUnit(m.unit); setFormCost(String(m.unit_cost));
    setFormTrade(m.trade || "general"); setFormSupplier(m.supplier || "");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await fetch("/api/call", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ function: "materials.updateMaterial", args: { data: { id: editingId, name: formName, unit: formUnit, unit_cost: parseFloat(formCost), trade: formTrade, supplier: formSupplier } } }),
          credentials: "include",
        });
      } else {
        await fetch("/api/call", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ function: "materials.createMaterial", args: { data: { name: formName, unit: formUnit, unit_cost: parseFloat(formCost), trade: formTrade, supplier: formSupplier } } }),
          credentials: "include",
        });
      }
      setShowModal(false);
      await refresh();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this material?")) return;
    await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "materials.deleteMaterial", args: { data: { id } } }),
      credentials: "include",
    });
    await refresh();
  };

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">Error: {error}</p></div>;
  if (!user) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Materials</h1>
          <button onClick={openCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Add Material</button>
        </div>

        {/* Search & Trade filter tabs */}
        <div className="mt-6 flex flex-wrap gap-4 items-center">
          <input
            type="text" placeholder="Search materials..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setActiveTrade("all")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${activeTrade === "all" ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"}`}>All</button>
          {trades.map((t: any) => (
            <button key={t} onClick={() => setActiveTrade(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${activeTrade === t ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"}`}>{t}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
            <p className="text-gray-500">{materials.length === 0 ? "No materials yet" : "No matching materials"}</p>
            {materials.length === 0 && <button onClick={openCreate} className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">Add your first material</button>}
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr><th className="px-4 py-3 text-left font-medium text-gray-500">Name</th><th className="px-4 py-3 text-left font-medium text-gray-500">Unit</th><th className="px-4 py-3 text-right font-medium text-gray-500">Unit Cost</th><th className="px-4 py-3 text-left font-medium text-gray-500">Trade</th><th className="px-4 py-3 text-left font-medium text-gray-500">Supplier</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filtered.map((m: any) => (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-950 cursor-pointer" onClick={() => openEdit(m)}>
                    <td className="px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3">{m.unit}</td>
                    <td className="px-4 py-3 text-right">${Number(m.unit_cost).toFixed(2)}</td>
                    <td className="px-4 py-3 capitalize">{m.trade}</td>
                    <td className="px-4 py-3 text-gray-500">{m.supplier || "—"}</td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleDelete(m.id)} className="text-xs text-red-600 hover:text-red-500">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editingId ? "Edit Material" : "Add Material"}</h3>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label><input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Unit</label><input type="text" value={formUnit} onChange={e => setFormUnit(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></div>
                <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Unit Cost</label><input type="number" step="0.01" value={formCost} onChange={e => setFormCost(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></div>
              </div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Trade</label><select value={formTrade} onChange={e => setFormTrade(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"><option value="electrical">Electrical</option><option value="plumbing">Plumbing</option><option value="hvac">HVAC</option><option value="roofing">Roofing</option><option value="general">General</option></select></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Supplier</label><input type="text" value={formSupplier} onChange={e => setFormSupplier(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? "Saving..." : editingId ? "Update" : "Add Material"}</button>
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
