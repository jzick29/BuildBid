// Bulk supplier import component — drag-drop CSV/Excel, column mapping, preview, upsert
import { useState, useRef, useCallback } from "react";

// BuildBid field labels for the mapping dropdown
const BID_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "Name *" },
  { key: "sku", label: "SKU" },
  { key: "unit", label: "Unit" },
  { key: "unit_cost", label: "Unit Cost" },
  { key: "category", label: "Category" },
  { key: "supplier", label: "Supplier" },
  { key: "description", label: "Description" },
];

interface BulkImportProps {
  onImported?: (result: { created: number; updated: number; skipped: number }) => void;
}

export function BulkImport({ onImported }: BulkImportProps) {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "importing" | "done">("upload");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string | number>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [supplierName, setSupplierName] = useState("");
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setError("");
    setFileName("");
    setColumns([]);
    setRows([]);
    setColumnMap({});
    setSupplierName("");
    setResult(null);
  };

  const toBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        res(base64);
      };
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(csv|xlsx?)$/i)) {
      setError("Please upload a CSV or Excel (.xlsx) file");
      return;
    }
    setError("");
    setFileName(file.name);

    try {
      const base64 = await toBase64(file);
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: "bulkImport.parseFile",
          args: { base64Data: base64, fileName: file.name, mediaType: file.type },
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Parse failed");

      setColumns(data.columns);
      setRows(data.rows);

      // Auto-detect common column names
      const lowerCols = data.columns.map((c: string) => c.toLowerCase());
      const map: Record<string, string> = {};
      for (const field of BID_FIELDS) {
        const idx = lowerCols.indexOf(field.key);
        if (idx >= 0) map[field.key] = data.columns[idx];
      }
      // Also try matching "price" / "cost" → unit_cost
      if (!map.unit_cost) {
        const costIdx = lowerCols.findIndex((c: string) => c === "price" || c === "cost" || c === "unit price" || c === "unitprice");
        if (costIdx >= 0) map.unit_cost = data.columns[costIdx];
      }
      // "category" → trade
      if (!map.category) {
        const catIdx = lowerCols.findIndex((c: string) => c === "category" || c === "trade" || c === "type");
        if (catIdx >= 0) map.category = data.columns[catIdx];
      }
      setColumnMap(map);
      setStep("map");
    } catch (e: any) {
      setError(e.message || "Failed to parse file");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = async () => {
    // Validate required mappings
    if (!columnMap.name) { setError("Please map the 'Name' field"); return; }
    if (!columnMap.unit_cost) { setError("Please map the 'Unit Cost' field"); return; }

    setError("");
    setStep("importing");

    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: "bulkImport.runImport",
          args: { columnMap, rows, supplierName },
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Import failed");

      setResult({ created: data.created, updated: data.updated, skipped: data.skipped });
      setStep("done");
      onImported?.({ created: data.created, updated: data.updated, skipped: data.skipped });
    } catch (e: any) {
      setError(e.message || "Import failed");
      setStep("preview");
    }
  };

  // ─── Render ────────────────────────────────────────────────────────

  if (step === "done" && result) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950/30">
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3">
          ✅ Import Complete
        </h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="rounded-lg bg-white dark:bg-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{result.created}</p>
            <p className="text-xs text-gray-500">New</p>
          </div>
          <div className="rounded-lg bg-white dark:bg-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
            <p className="text-xs text-gray-500">Updated</p>
          </div>
          <div className="rounded-lg bg-white dark:bg-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-gray-500">{result.skipped}</p>
            <p className="text-xs text-gray-500">Skipped</p>
          </div>
        </div>
        <button onClick={reset} className="text-sm text-indigo-600 hover:underline">Import another file</button>
      </div>
    );
  }

  if (step === "upload") {
    return (
      <div>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${dragOver ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20" : "border-gray-300 dark:border-gray-700"}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-4xl mb-3">📄</p>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Drag &amp; drop your supplier price list here
          </p>
          <p className="text-xs text-gray-500">CSV or Excel (.xlsx) files</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>
    );
  }

  // ─── Mapping step ──────────────────────────────────────────────────

  if (step === "map" || step === "preview") {
    return (
      <div>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {/* Supplier name override */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Default supplier name (applied to all rows)
          </label>
          <input
            type="text"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            placeholder="e.g. Home Depot, Ferguson"
          />
        </div>

        {/* Column mapping */}
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Map supplier columns to BuildBid fields:
        </p>
        <div className="space-y-2 mb-4">
          {BID_FIELDS.map((field) => (
            <div key={field.key} className="flex items-center gap-3">
              <span className="w-28 text-xs text-gray-500 text-right shrink-0">{field.label}</span>
              <span className="text-xs text-gray-400">→</span>
              <select
                value={columnMap[field.key] || ""}
                onChange={(e) => setColumnMap({ ...columnMap, [field.key]: e.target.value })}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <option value="">— Skip —</option>
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Preview table */}
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Preview (first {Math.min(10, rows.length)} of {rows.length} rows):
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {BID_FIELDS.filter((f) => columnMap[f.key]).map((f) => (
                  <th key={f.key} className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((row, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                  {BID_FIELDS.filter((f) => columnMap[f.key]).map((f) => (
                    <td key={f.key} className="px-3 py-1.5 text-gray-800 dark:text-gray-200 whitespace-nowrap">
                      {String(row[columnMap[f.key]] || "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={step === "importing"}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {step === "importing" ? "⏳ Importing..." : "Import All Rows"}
          </button>
          <button onClick={reset} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return null;
}
