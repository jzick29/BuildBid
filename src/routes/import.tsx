import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState, useCallback } from "react";

export const Route = createFileRoute("/import")({
  loader: async () => ({}),
  component: ImportPage,
});

const COLUMN_ALIASES: Record<string, string> = {
  name: "name", item: "name", description: "description", desc: "description",
  unit: "unit", uom: "unit", cost: "unit_cost", price: "unit_cost", unit_cost: "unit_cost",
  trade: "trade", category: "trade", supplier: "supplier", vendor: "supplier",
};

function ImportPage() {
  const router = useRouter();

  const [preview, setPreview] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) return;
      const rawHeaders = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
      const mapped = rawHeaders.map(h => COLUMN_ALIASES[h] || h);
      setHeaders(mapped);
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/"/g, ""));
        const obj: any = {};
        mapped.forEach((h, i) => { obj[h] = vals[i] || ""; });
        return obj;
      });
      setPreview(rows);
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) handleFile(file);
  }, []);

  const handleImport = async () => {
    setUploading(true);
    try {
      const items = preview.map(row => ({
        name: row.name || row.description || "",
        description: row.description || "",
        unit: row.unit || "each",
        unit_cost: parseFloat(row.unit_cost) || 0,
        trade: row.trade || "",
        supplier: row.supplier || "",
      })).filter(i => i.name);
      await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "materials.importMaterials", args: { data: { rows: items } } }), credentials: "include" }).then(r => r.json());
      setDone(true);
    } catch (e) { /* ignore */ }
    finally { setUploading(false); }
  };

  return (
    <div className="flex min-h-dvh flex-col">

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-bold">Import Materials</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Upload supplier price lists as CSV files.</p>

        {done ? (
          <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-8 text-center dark:border-green-800 dark:bg-green-950/30">
            <p className="text-lg font-semibold text-green-700 dark:text-green-400">✓ {preview.filter(i => i.name).length} materials imported!</p>
            <Link to="/materials" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500">View Material Library →</Link>
          </div>
        ) : (
          <>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={onDrop}
              className="mt-8 rounded-xl border-2 border-dashed border-gray-300 p-12 text-center transition-colors hover:border-indigo-500 dark:border-gray-700 dark:hover:border-indigo-500"
            >
              <p className="text-lg font-medium text-gray-600 dark:text-gray-400">Drop a CSV file here</p>
              <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">or</p>
              <label className="mt-3 inline-block cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                Browse Files
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </label>
              <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">Supports Ferguson, Home Depot Pro, and generic CSV formats</p>
            </div>

            {preview.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Preview ({preview.length} rows)</h2>
                  <button onClick={handleImport} disabled={uploading} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                    {uploading ? "Importing..." : "Confirm Import"}
                  </button>
                </div>
                <div className="mt-4 max-h-96 overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
                        {headers.map(h => <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 capitalize">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {preview.map((row, i) => (
                        <tr key={i}><td className="px-3 py-2">{row.name || "—"}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
