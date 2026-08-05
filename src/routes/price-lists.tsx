import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/price-lists")({
  component: PriceListsPage,
  loader: async () => ({}),
});

function PriceListsPage() {
  const [supplierLists, setSupplierLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [csvData, setCsvData] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [supplierMaterials, setSupplierMaterials] = useState<any[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  // Comparison view
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  useEffect(() => {
    fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "priceLists.getPriceLists", args: {} }),
      credentials: "include",
    })
    .then(r => r.json())
    .then(d => { if (Array.isArray(d)) setSupplierLists(d); })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  // Supplier summary cards
  const supplierCards = useMemo(() => supplierLists.map((list: any) => {
    const avgPrice = supplierMaterials.length > 0 && expandedSupplier === list.supplier
      ? supplierMaterials.reduce((s: number, m: any) => s + (m.unit_cost || 0), 0) / supplierMaterials.length
      : 0;
    return { ...list, avgPrice };
  }), [supplierLists, supplierMaterials, expandedSupplier]);

  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const nameIdx = headers.findIndex((h) => h === "name" || h === "item");
    const unitIdx = headers.findIndex((h) => h === "unit");
    const costIdx = headers.findIndex((h) => h === "cost" || h === "price" || h === "unit_cost");
    const tradeIdx = headers.findIndex((h) => h === "trade" || h === "category");
    
    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      return {
        name: cols[nameIdx] || "",
        unit: cols[unitIdx] || "each",
        unit_cost: parseFloat(cols[costIdx]) || 0,
        trade: tradeIdx >= 0 ? cols[tradeIdx] : "",
      };
    }).filter((i) => i.name && i.unit_cost > 0);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCsvData(text);
    if (text.trim()) {
      setPreview(parseCSV(text));
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!supplier || !preview?.length) return;
    setUploading(true);
    try {
      const resp = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "priceLists.uploadPriceList", args: { data: { supplier, items: preview } } }), credentials: "include" });
      await resp.json();
      setShowUpload(false);
      setSupplier("");
      setCsvData("");
      setPreview(null);
      const updated = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "priceLists.getPriceLists", args: {} }), credentials: "include" }).then(r => r.json());
      setSupplierLists(Array.isArray(updated) ? updated : []);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleExpand = async (supplier: string) => {
    if (expandedSupplier === supplier) {
      setExpandedSupplier(null);
      return;
    }
    setExpandedSupplier(supplier);
    setLoadingMaterials(true);
    try {
      const mats = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "priceLists.getMaterialsBySupplier", args: { data: { supplier } } }), credentials: "include" }).then(r => r.json());
      setSupplierMaterials(Array.isArray(mats) ? mats : []);
    } catch { setSupplierMaterials([]); }
    setLoadingMaterials(false);
  };

  const handleApplyToMaterials = async () => {
    if (supplierMaterials.length === 0) return;
    if (!confirm(`Apply prices from this list to your materials? This will update ${supplierMaterials.length} items.`)) return;
    for (const m of supplierMaterials) {
      try {
        await fetch("/api/call", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ function: "materials.updateMaterial", args: { data: { id: m.id, name: m.name, unit: m.unit, unit_cost: m.unit_cost, trade: m.trade, supplier: m.supplier } } }),
          credentials: "include",
        });
      } catch {}
    }
    alert("Materials updated!");
  };

  const handleCompare = async () => {
    if (supplierLists.length < 2) { alert("Need at least 2 suppliers to compare"); return; }
    setShowComparison(true);
    setComparisonLoading(true);
    try {
      const allMats: any[] = [];
      for (const list of supplierLists) {
        const mats = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "priceLists.getMaterialsBySupplier", args: { data: { supplier: list.supplier } } }), credentials: "include" }).then(r => r.json());
        for (const m of (mats || [])) {
          allMats.push({ ...m, supplier: list.supplier });
        }
      }
      // Group by name, compare prices
      const byName: Record<string, any[]> = {};
      for (const m of allMats) {
        const key = m.name.toLowerCase();
        if (!byName[key]) byName[key] = [];
        byName[key].push(m);
      }
      const comp = Object.entries(byName)
        .filter(([, items]) => items.length >= 2)
        .map(([name, items]) => {
          const prices = items.map((i: any) => ({ supplier: i.supplier, price: i.unit_cost }));
          const best = prices.reduce((min: any, p: any) => p.price < min.price ? p : min, prices[0]);
          return { name: items[0].name, prices, bestSupplier: best.supplier, bestPrice: best.price };
        });
      setComparisonData(comp);
    } catch { setComparisonData([]); }
    finally { setComparisonLoading(false); }
  };

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Price Lists</h1>
          <p className="text-gray-500">Manage supplier material prices linked to your estimates.</p>
        </div>
        <div className="flex gap-2">
          {supplierLists.length >= 2 && (
            <button onClick={handleCompare} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm">
              Compare Prices
            </button>
          )}
          <button onClick={() => setShowUpload(!showUpload)} className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 text-sm">
            {showUpload ? "Cancel" : "Upload Price List"}
          </button>
        </div>
      </div>

      {/* Supplier Summary Cards */}
      {supplierLists.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {supplierCards.map((list: any) => (
            <div key={list.supplier} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <h3 className="font-semibold text-sm truncate">{list.supplier}</h3>
              <p className="text-xs text-gray-500 mt-1">{list.item_count} items</p>
              <p className="text-xs text-gray-400">Updated {new Date(list.updated_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Price Comparison Modal */}
      {showComparison && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowComparison(false)}>
          <div className="mx-4 w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Price Comparison</h3>
              <button onClick={() => setShowComparison(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {comparisonLoading ? (
              <p className="text-center text-gray-400 py-8">Loading comparison...</p>
            ) : comparisonData.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No overlapping items found between suppliers</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-950">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Item</th>
                      {supplierLists.map((s: any) => <th key={s.supplier} className="px-3 py-2 text-right font-medium text-gray-500">{s.supplier}</th>)}
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Best</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {comparisonData.map((row: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{row.name}</td>
                        {supplierLists.map((s: any) => {
                          const p = row.prices.find((pp: any) => pp.supplier === s.supplier);
                          return (
                            <td key={s.supplier} className={`px-3 py-2 text-right ${p && p.price === row.bestPrice ? "font-semibold text-green-600 dark:text-green-400" : "text-gray-500"}`}>
                              {p ? "$" + p.price.toFixed(2) : "—"}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right font-semibold text-green-600 dark:text-green-400">${row.bestPrice.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showUpload && (
        <div className="border rounded-lg p-4 mb-6 bg-gray-50">
          <h3 className="font-semibold mb-3">Upload Supplier Price List</h3>
          <input type="text" placeholder="Supplier name (e.g., Ferguson, Home Depot Pro)" value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-full border rounded-md px-3 py-2 mb-3" />
          <p className="text-xs text-gray-500 mb-2">Paste CSV: <code>name,unit,cost,trade</code> (one item per line)</p>
          <textarea placeholder="name,unit,cost,trade&#10;12/2 Romex,roll,89.50,electrical&#10;Romex connector,each,0.75,electrical&#10;20A AFCI breaker,each,42.00,electrical" value={csvData} onChange={handleFileUpload} rows={6} className="w-full border rounded-md px-3 py-2 text-sm font-mono" />
          {preview && (
            <div className="mt-3">
              <p className="text-sm text-gray-600 mb-1">{preview.length} items detected</p>
              <div className="max-h-32 overflow-y-auto border rounded bg-white text-sm">
                <table className="w-full"><thead className="bg-gray-100"><tr><th className="p-1 text-left">Name</th><th className="p-1 text-left">Unit</th><th className="p-1 text-right">Cost</th><th className="p-1 text-left">Trade</th></tr></thead>
                <tbody>{preview.slice(0, 10).map((item, i) => (<tr key={i} className="border-t"><td className="p-1">{item.name}</td><td className="p-1">{item.unit}</td><td className="p-1 text-right">${item.unit_cost.toFixed(2)}</td><td className="p-1">{item.trade}</td></tr>))}</tbody></table>
              </div>
              <button onClick={handleUpload} disabled={uploading || !supplier} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">{uploading ? "Uploading..." : `Save ${preview.length} Items to ${supplier || "..."}`}</button>
            </div>
          )}
        </div>
      )}

      {supplierLists.length === 0 && !showUpload && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">📋</p>
          <p>No price lists uploaded yet</p>
          <p className="text-sm mt-1">Upload supplier price lists to link line items to live prices</p>
        </div>
      )}

      <div className="space-y-2">
        {supplierLists.map((list: any) => (
          <div key={list.supplier}>
            <button onClick={() => handleExpand(list.supplier)} className="w-full border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 text-left">
              <div>
                <h3 className="font-semibold">{list.supplier}</h3>
                <p className="text-sm text-gray-500">{list.item_count} items · Updated {new Date(list.updated_at).toLocaleDateString()}</p>
              </div>
              <span className="text-gray-400">{expandedSupplier === list.supplier ? "▲" : "▼"}</span>
            </button>
            {expandedSupplier === list.supplier && (
              <div className="border-x border-b rounded-b-lg p-3 bg-white">
                {loadingMaterials ? (
                  <p className="text-sm text-gray-400">Loading...</p>
                ) : supplierMaterials.length === 0 ? (
                  <p className="text-sm text-gray-400">No materials</p>
                ) : (
                  <>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b text-left text-gray-500"><th className="p-1">Name</th><th className="p-1">Unit</th><th className="p-1 text-right">Cost</th><th className="p-1">Trade</th></tr></thead>
                        <tbody>{supplierMaterials.map((m: any) => (<tr key={m.id} className="border-t"><td className="p-1">{m.name}</td><td className="p-1">{m.unit}</td><td className="p-1 text-right">${m.unit_cost.toFixed(2)}</td><td className="p-1">{m.trade}</td></tr>))}</tbody>
                      </table>
                    </div>
                    <button onClick={handleApplyToMaterials} className="mt-3 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
                      Apply to Materials
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
