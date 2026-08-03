import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getPriceLists, uploadPriceList, getMaterialsBySupplier } from "../lib/price-lists";

export const Route = createFileRoute("/price-lists")({
  component: PriceListsPage,
  loader: async () => {
    try {
      const lists = await getPriceLists();
      return { lists };
    } catch { return { lists: [] }; }
  },
});

function PriceListsPage() {
  const { lists } = Route.useLoaderData();
  const [supplierLists, setSupplierLists] = useState(lists);
  const [showUpload, setShowUpload] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [csvData, setCsvData] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [supplierMaterials, setSupplierMaterials] = useState<any[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

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
      const result = await uploadPriceList({ data: { supplier, items: preview } });
      setShowUpload(false);
      setSupplier("");
      setCsvData("");
      setPreview(null);
      const updated = await getPriceLists();
      setSupplierLists(updated as any);
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
      const mats = await getMaterialsBySupplier({ data: { supplier } });
      setSupplierMaterials(mats as any[]);
    } catch { setSupplierMaterials([]); }
    setLoadingMaterials(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Price Lists</h1>
          <p className="text-gray-500">Manage supplier material prices linked to your estimates.</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
        >
          {showUpload ? "Cancel" : "Upload Price List"}
        </button>
      </div>

      {showUpload && (
        <div className="border rounded-lg p-4 mb-6 bg-gray-50">
          <h3 className="font-semibold mb-3">Upload Supplier Price List</h3>
          <input
            type="text"
            placeholder="Supplier name (e.g., Ferguson, Home Depot Pro)"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="w-full border rounded-md px-3 py-2 mb-3"
          />
          <p className="text-xs text-gray-500 mb-2">
            Paste CSV: <code>name,unit,cost,trade</code> (one item per line)
          </p>
          <textarea
            placeholder="name,unit,cost,trade&#10;12/2 Romex,roll,89.50,electrical&#10;Romex connector,each,0.75,electrical&#10;20A AFCI breaker,each,42.00,electrical"
            value={csvData}
            onChange={handleFileUpload}
            rows={6}
            className="w-full border rounded-md px-3 py-2 text-sm font-mono"
          />
          {preview && (
            <div className="mt-3">
              <p className="text-sm text-gray-600 mb-1">{preview.length} items detected</p>
              <div className="max-h-32 overflow-y-auto border rounded bg-white text-sm">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-1 text-left">Name</th>
                      <th className="p-1 text-left">Unit</th>
                      <th className="p-1 text-right">Cost</th>
                      <th className="p-1 text-left">Trade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((item, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1">{item.name}</td>
                        <td className="p-1">{item.unit}</td>
                        <td className="p-1 text-right">${item.unit_cost.toFixed(2)}</td>
                        <td className="p-1">{item.trade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading || !supplier}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : `Save ${preview.length} Items to ${supplier || "..."}`}
              </button>
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
            <button
              onClick={() => handleExpand(list.supplier)}
              className="w-full border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 text-left"
            >
              <div>
                <h3 className="font-semibold">{list.supplier}</h3>
                <p className="text-sm text-gray-500">
                  {list.item_count} items · Updated {new Date(list.updated_at).toLocaleDateString()}
                </p>
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
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="p-1">Name</th>
                          <th className="p-1">Unit</th>
                          <th className="p-1 text-right">Cost</th>
                          <th className="p-1">Trade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierMaterials.map((m: any) => (
                          <tr key={m.id} className="border-t">
                            <td className="p-1">{m.name}</td>
                            <td className="p-1">{m.unit}</td>
                            <td className="p-1 text-right">${m.unit_cost.toFixed(2)}</td>
                            <td className="p-1">{m.trade}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
