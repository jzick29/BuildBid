import { useState } from "react";
import { useRouter } from "@tanstack/react-router";

type AiLineItem = {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  markup: number;
  confidence: "high" | "medium" | "low";
  laborPerUnit: number;
};

type AiResult = {
  lineItems: AiLineItem[];
  laborHours: number;
  materialsSubtotal: number;
  laborSubtotal: number;
  recommendedMarkup: number;
  laborRate: number;
  trade: string;
  location: string;
  regionMultiplier: number;
  squareFootage: number;
  rooms: number;
  matched: string[];
  note: string;
};

const TRADES = ["electrical", "hvac", "plumbing", "roofing", "general"];
const EXAMPLE = "Replace a 40-gallon gas water heater in a basement with power vent. Need to remove old unit, install new one, add expansion tank, and run new gas line 15ft.";

const confidenceStyles: Record<string, string> = {
  high: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800";

export function AiEstimator() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [trade, setTrade] = useState("plumbing");
  const [location, setLocation] = useState("");
  const [squareFootage, setSquareFootage] = useState("");
  const [rooms, setRooms] = useState("");
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [items, setItems] = useState<AiLineItem[]>([]);
  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const generate = async () => {
    if (!description.trim()) { setError("Describe the job first"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/ai/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          description,
          trade,
          location,
          squareFootage: squareFootage ? Number(squareFootage) : undefined,
          rooms: rooms ? Number(rooms) : undefined,
          photos: photoNames.map((n) => ({ name: n })),
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || "Failed to generate");
      setResult(d);
      setItems(d.lineItems || []);
    } catch (e: any) {
      setError(e?.message || "Failed to generate estimate");
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<AiLineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const totals = items.reduce(
    (acc, it) => ({
      materials: acc.materials + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0),
      labor: acc.labor + (Number(it.quantity) || 0) * (Number(it.laborPerUnit) || 0),
    }),
    { materials: 0, labor: 0 }
  );
  const laborCost = totals.labor * (result?.laborRate || 85);

  const handleAdd = async () => {
    if (!projectName.trim() || !customerName.trim()) { setAddError("Project and customer name are required"); return; }
    setAdding(true); setAddError("");
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          function: "ai.createEstimate",
          args: {
            data: {
              projectName,
              customerName,
              trade,
              lineItems: items,
              laborHours: Math.round(totals.labor * 10) / 10,
              laborRate: result?.laborRate,
              notes: description,
            },
          },
        }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      if (typeof window !== "undefined") (window as any).__buildbidTrack?.("ai_estimate_created");
      router.navigate({ to: `/estimates/${d.id}` });
    } catch (e: any) {
      setAddError(e?.message || "Failed to create estimate");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* ---- Input form ---- */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Describe the Job</h2>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Type the job in plain English and we'll turn it into a line-item estimate.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Job Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder={EXAMPLE}
              className={inputCls}
            />
            <button type="button" onClick={() => setDescription(EXAMPLE)} className="mt-1 text-xs text-indigo-500 hover:underline">
              Use example
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Trade</label>
              <select value={trade} onChange={(e) => setTrade(e.target.value)} className={inputCls}>
                {TRADES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Location (optional)</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Square Footage</label>
              <input type="number" min="0" value={squareFootage} onChange={(e) => setSquareFootage(e.target.value)} placeholder="e.g. 2000" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Rooms / Bedrooms</label>
              <input type="number" min="0" value={rooms} onChange={(e) => setRooms(e.target.value)} placeholder="e.g. 3" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Project Photos (optional)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setPhotoNames(Array.from(e.target.files || []).map((f) => f.name))}
              className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-600 hover:file:bg-indigo-100 dark:text-gray-400 dark:file:bg-indigo-950 dark:file:text-indigo-400"
            />
            {photoNames.length > 0 && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{photoNames.length} photo(s) selected — attached for reference</p>
            )}
          </div>
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">{error}</div>}
          <button
            onClick={generate}
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Generating..." : result ? "Regenerate Estimate" : "Generate Estimate"}
          </button>
        </div>
      </div>

      {/* ---- Results ---- */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Generated Line Items</h2>
          {result && (
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              {items.length} item{items.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {!result ? (
          <div className="mt-10 flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-indigo-50 p-4 dark:bg-indigo-950/50">
              <svg className="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
            </div>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Your generated line items will appear here —<br />editable before you add them to an estimate.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {result.note && (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">{result.note}</p>
            )}
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="w-20 px-2 py-2 font-medium">Qty</th>
                    <th className="w-20 px-2 py-2 font-medium">Unit</th>
                    <th className="w-24 px-2 py-2 font-medium">Unit Cost</th>
                    <th className="w-20 px-2 py-2 font-medium">Markup</th>
                    <th className="w-24 px-2 py-2 text-right font-medium">Total</th>
                    <th className="w-10 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((it, i) => (
                    <tr key={i} className="align-top">
                      <td className="px-3 py-2">
                        <input
                          value={it.name}
                          onChange={(e) => updateItem(i, { name: e.target.value })}
                          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium hover:border-gray-300 focus:border-indigo-500 focus:outline-none dark:hover:border-gray-700"
                        />
                        <input
                          value={it.description}
                          onChange={(e) => updateItem(i, { description: e.target.value })}
                          className="mt-0.5 w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-gray-500 hover:border-gray-300 focus:border-indigo-500 focus:outline-none dark:text-gray-400 dark:hover:border-gray-700"
                        />
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${confidenceStyles[it.confidence] || confidenceStyles.low}`}>
                          {it.confidence} confidence
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" min="0" step="any" value={it.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-800" />
                      </td>
                      <td className="px-2 py-2">
                        <input value={it.unit} onChange={(e) => updateItem(i, { unit: e.target.value })} className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-800" />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" min="0" step="any" value={it.unitCost} onChange={(e) => updateItem(i, { unitCost: Number(e.target.value) })} className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-800" />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" min="0" step="any" value={it.markup} onChange={(e) => updateItem(i, { markup: Number(e.target.value) })} className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-800" />
                      </td>
                      <td className="px-2 py-2 text-right text-xs font-medium whitespace-nowrap">
                        ${((Number(it.quantity) || 0) * (Number(it.unitCost) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500" title="Remove item">&times;</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-800/50 sm:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Labor Hours</p>
                <p className="mt-1 text-lg font-bold">{Math.round(totals.labor * 10) / 10} hr</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Materials</p>
                <p className="mt-1 text-lg font-bold">${totals.materials.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Labor ({result.laborRate ? `$${result.laborRate}/hr` : ""})</p>
                <p className="mt-1 text-lg font-bold">${laborCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Rec. Markup</p>
                <p className="mt-1 text-lg font-bold">{result.recommendedMarkup}%</p>
              </div>
            </div>
            {result.regionMultiplier !== 1 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Regional pricing adjustment applied for {result.location || "this location"} (&times;{result.regionMultiplier}).
              </p>
            )}

            {/* Add to estimate */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
              <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Add to Estimate</h3>
              {addError && <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">{addError}</p>}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" />
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" />
              </div>
              <button
                onClick={handleAdd}
                disabled={adding || items.length === 0}
                className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {adding ? "Creating estimate..." : "Add to Estimate →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
