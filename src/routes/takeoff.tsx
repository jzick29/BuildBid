import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
export const Route = createFileRoute("/takeoff")({ component: TakeoffPage });

const fmt = (n: any, d = 2) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d === 0 ? 0 : 2 });

function TakeoffPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", file: null as File | null });
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<any>(null); // project detail
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mode, setMode] = useState<"calibrate" | "line" | "area" | "count">("line");
  const [draft, setDraft] = useState<{ x: number; y: number }[]>([]);
  const [scaleInput, setScaleInput] = useState("");
  const [calPts, setCalPts] = useState<{ x: number; y: number }[]>([]);
  const [showScalePrompt, setShowScalePrompt] = useState(false);
  const [msg, setMsg] = useState("");
  const [imgTick, setImgTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const modeRef = useRef(mode);
  const draftRef = useRef(draft);
  const activeRef = useRef(active);
  const msRef = useRef(measurements);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { msRef.current = measurements; }, [measurements]);

  const call = async (fn: string, data: any) => {
    const res = await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: fn, args: { data } }),
      credentials: "include",
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    return d;
  };

  const fetchList = async () => {
    try {
      const me = await fetch("/api/me", { credentials: "include" }).then(r => r.json());
      if (!me.user) { window.location.href = "/login"; return; }
      const d = await call("takeoffs.list", {});
      setProjects(d.projects || []);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { fetchList(); }, []);

  const openProject = async (id: string) => {
    setActive(null); setDraft([]); setCalPts([]); setMsg("");
    setDetailLoading(true);
    try {
      const d = await call("takeoffs.get", { projectId: id });
      setActive(d.project);
      setMeasurements(d.measurements || []);
    } catch (e: any) { alert(e.message); }
    finally { setDetailLoading(false); }
  };

  // resize image client-side to keep data URL small
  const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1200;
        let { width, height } = img;
        if (width > max || height > max) {
          const scale = max / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const c = document.createElement("canvas");
        c.width = width; c.height = height;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.file) return;
    setSaving(true);
    try {
      const imageUrl = await fileToDataUrl(createForm.file);
      await call("takeoffs.create", { title: createForm.title, imageUrl });
      setShowCreate(false);
      setCreateForm({ title: "", file: null });
      fetchList();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const ppu = active?.pixels_per_unit ? Number(active.pixels_per_unit) : null;

  const distPx = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const polyAreaPx = (pts: { x: number; y: number }[]) => {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
      sum += p1.x * p2.y - p2.x * p1.y;
    }
    return Math.abs(sum) / 2;
  };

  // canvas render
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !active) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    const drawAll = () => {
      ctx.drawImage(img, 0, 0);
      // committed measurements
      for (const m of msRef.current) {
        const pts = JSON.parse(m.points || "[]");
        ctx.beginPath();
        if (m.kind === "line") {
          ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 2;
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        } else if (m.kind === "area") {
          ctx.fillStyle = "rgba(59,130,246,0.15)";
          ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 2;
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
        } else {
          ctx.fillStyle = "#ef4444";
          for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      // calibration line
      if (modeRef.current === "calibrate" && calPts.length === 1) {
        ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(calPts[0].x, calPts[0].y);
        const m = lastMouseRef.current;
        if (m) ctx.lineTo(m.x, m.y);
        ctx.stroke(); ctx.setLineDash([]);
      }
      // draft
      const draft = draftRef.current;
      if (draft.length > 0) {
        ctx.beginPath();
        if (modeRef.current === "line") {
          ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
          ctx.moveTo(draft[0].x, draft[0].y);
          for (let i = 1; i < draft.length; i++) ctx.lineTo(draft[i].x, draft[i].y);
          const m = lastMouseRef.current;
          if (m) ctx.lineTo(m.x, m.y);
          ctx.stroke(); ctx.setLineDash([]);
        } else if (modeRef.current === "area") {
          ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
          ctx.moveTo(draft[0].x, draft[0].y);
          for (let i = 1; i < draft.length; i++) ctx.lineTo(draft[i].x, draft[i].y);
          const m = lastMouseRef.current;
          if (m && draft.length >= 1) ctx.lineTo(m.x, m.y);
          ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.fillStyle = "#fff";
        for (const p of draft) { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = modeRef.current === "area" ? "#3b82f6" : "#22c55e"; ctx.stroke(); }
      }
    };
    drawAll();
  }, [active, measurements, draft, calPts, mode, imgTick]);

  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!active) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const pt = { x: Math.round(x), y: Math.round(y) };
    if (mode === "calibrate") {
      const next = [...calPts, pt];
      if (next.length === 2) { setCalPts(next); setShowScalePrompt(true); }
      else setCalPts(next);
      return;
    }
    if (mode === "count") {
      const value = 1;
      call("takeoffs.addMeasurement", { projectId: active.id, label: "Count", kind: "count", points: [pt], value, unit: "ea" })
        .then(() => { refreshMeasurements(); })
        .catch((err: any) => alert(err.message));
      return;
    }
    // line / area: add point
    setDraft([...draft, pt]);
  };

  const onCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    lastMouseRef.current = {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const refreshMeasurements = async () => {
    if (activeRef.current) {
      const d = await call("takeoffs.get", { projectId: activeRef.current.id });
      setMeasurements(d.measurements || []);
    }
  };

  const finishDraft = async () => {
    if (!active) return;
    if (draft.length < 2) { setMsg("Click at least 2 points on the drawing."); return; }
    if (!ppu) { setMsg("Calibrate the scale first (Set Scale below)."); return; }
    try {
      if (mode === "line") {
        let px = 0;
        for (let i = 1; i < draft.length; i++) px += distPx(draft[i - 1], draft[i]);
        const value = px / ppu;
        await call("takeoffs.addMeasurement", { projectId: active.id, label: "Length", kind: "line", points: draft, value, unit: active.scale_label || "ft" });
      } else if (mode === "area") {
        if (draft.length < 3) { setMsg("Area needs at least 3 points."); return; }
        const value = polyAreaPx(draft) / (ppu * ppu);
        await call("takeoffs.addMeasurement", { projectId: active.id, label: "Area", kind: "area", points: draft, value, unit: "sq " + (active.scale_label || "ft") });
      }
      setDraft([]);
      await refreshMeasurements();
    } catch (err: any) { alert(err.message); }
  };

  const confirmScale = async () => {
    const real = Number(scaleInput);
    if (!Number.isFinite(real) || real <= 0) { setMsg("Enter a positive real length."); return; }
    if (calPts.length !== 2) return;
    const px = distPx(calPts[0], calPts[1]);
    const ppuVal = px / real;
    const unit = active.scale_label || "ft";
    try {
      await call("takeoffs.setScale", { projectId: active.id, pixelsPerUnit: ppuVal, scaleLabel: unit });
      const d = await call("takeoffs.get", { projectId: active.id });
      setActive(d.project);
      setMeasurements(d.measurements || []);
      setCalPts([]); setScaleInput(""); setShowScalePrompt(false);
      setMode("line");
      setMsg(`Scale set: ${fmt(ppuVal, 2)} px per ${unit}.`);
    } catch (err: any) { alert(err.message); }
  };

  const removeMeasurement = async (id: string) => {
    try { await call("takeoffs.deleteMeasurement", { measurementId: id }); refreshMeasurements(); }
    catch (err: any) { alert(err.message); }
  };

  const deleteProject = async (id: string) => {
    if (!confirm("Delete this takeoff and all measurements?")) return;
    try { await call("takeoffs.delete", { projectId: id }); setActive(null); fetchList(); }
    catch (err: any) { alert(err.message); }
  };

  const totals = {
    length: measurements.filter(m => m.kind === "line").reduce((s, m) => s + Number(m.value), 0),
    area: measurements.filter(m => m.kind === "area").reduce((s, m) => s + Number(m.value), 0),
    count: measurements.filter(m => m.kind === "count").reduce((s, m) => s + Number(m.value), 0),
  };
  const unit = active?.scale_label || "ft";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Plan Room / Takeoff</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Upload blueprints, calibrate the scale, and measure lengths, areas, and counts.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">New Takeoff</button>
      </div>

      {!active ? (
        loading ? <p className="mt-8 text-sm text-gray-500">Loading…</p>
        : projects.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">No takeoffs yet. Upload a blueprint to start measuring.</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p: any) => (
              <div key={p.id} className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <button onClick={() => openProject(p.id)} className="block w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-900">
                  <p className="font-semibold text-gray-900 dark:text-white">{p.title}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {p.measurement_count} measurement{p.measurement_count === 1 ? "" : "s"}
                    {p.pixels_per_unit ? ` · ${fmt(p.pixels_per_unit, 2)} px/${p.scale_label || "ft"}` : " · not calibrated"}
                  </p>
                </button>
                <div className="flex justify-end border-t border-gray-200 px-3 py-1.5 dark:border-gray-800">
                  <button onClick={() => deleteProject(p.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="mt-6">
          {detailLoading ? <p className="text-sm text-gray-500">Loading…</p> : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setActive(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">← All takeoffs</button>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{active.title}</h2>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ppu ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"}`}>{ppu ? `Calibrated · ${fmt(ppu, 2)} px/${unit}` : "Not calibrated"}</span>
              </div>
              {msg && <p className="mt-2 text-xs text-indigo-600 dark:text-indigo-400">{msg}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {([["line", "Measure Line"], ["area", "Measure Area"], ["count", "Count Items"], ["calibrate", "Set Scale"]] as const).map(([m, label]) => (
                  <button key={m} onClick={() => { setMode(m); setDraft([]); setCalPts([]); }} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === m ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300"}`}>{label}</button>
                ))}
                {(mode === "line" || mode === "area") && (
                  <button onClick={finishDraft} disabled={draft.length < 2} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40">Finish ({draft.length} pts)</button>
                )}
                {draft.length > 0 && <button onClick={() => setDraft([])} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">Clear draft</button>}
              </div>
              <p className="mt-2 text-xs text-gray-400">{mode === "line" ? "Click points along the run — each click adds a segment." : mode === "area" ? "Click corners of the area, then Finish to compute square footage." : mode === "count" ? "Click each item to count it." : "Click two points on a known-length feature, then enter the real length."}</p>

              <div className="mt-3 overflow-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                <canvas ref={canvasRef} onClick={onCanvasClick} onMouseMove={onCanvasMove} className="max-w-none cursor-crosshair" />
                <img ref={imgRef} src={active.image_url} alt={active.title} className="hidden" onLoad={() => { const c = canvasRef.current; const im = imgRef.current; if (c && im) { c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d")!.drawImage(im, 0, 0); setImgTick(t => t + 1); } }} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Measurements</h3>
                  {measurements.length === 0 ? <p className="mt-2 text-sm text-gray-400">No measurements yet.</p> : (
                    <table className="mt-2 w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-950">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600 dark:text-gray-400">Type</th>
                          <th className="px-2 py-1.5 text-right font-medium text-gray-600 dark:text-gray-400">Value</th>
                          <th className="px-2 py-1.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {measurements.map((m: any) => (
                          <tr key={m.id}>
                            <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300 capitalize">{m.kind === "line" ? "Length" : m.kind === "area" ? "Area" : "Count"}</td>
                            <td className="px-2 py-1.5 text-right font-medium text-gray-900 dark:text-white">{fmt(m.value)} {m.unit}</td>
                            <td className="px-2 py-1.5 text-right"><button onClick={() => removeMeasurement(m.id)} className="text-xs text-red-500 hover:underline">✕</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {measurements.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 border-t border-gray-200 pt-2 text-xs dark:border-gray-800">
                      {totals.length > 0 && <span className="rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400">Σ length {fmt(totals.length)} {unit}</span>}
                      {totals.area > 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">Σ area {fmt(totals.area)} sq {unit}</span>}
                      {totals.count > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-400">Σ count {fmt(totals.count, 0)}</span>}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Scale</h3>
                  {!ppu ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-gray-500">1. Click <b>Set Scale</b>, then click two points on the drawing that represent a known distance (e.g. a dimension line).</p>
                      {calPts.length === 1 && <p className="text-xs text-amber-600">Now click the second point…</p>}
                      {showScalePrompt && (
                        <div className="flex items-center gap-2">
                          <input value={scaleInput} onChange={e => setScaleInput(e.target.value)} type="number" step="any" min="0" placeholder={`Real length (${unit})`} className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950" />
                          <button onClick={confirmScale} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">Apply</button>
                          <button onClick={() => { setCalPts([]); setShowScalePrompt(false); }} className="text-xs text-gray-500">Cancel</button>
                        </div>
                      )}
                      {calPts.length === 2 && !showScalePrompt && <p className="text-xs text-gray-400">Enter the real length above.</p>}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{fmt(ppu, 2)} pixels = 1 {unit}{active.scale_label ? ` (labeled "${active.scale_label}")` : ""}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-950 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">New Takeoff</h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <input required value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} placeholder="Project name (e.g. Maple St. floor plan)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
              <input required type="file" accept="image/*" onChange={e => setCreateForm({ ...createForm, file: e.target.files?.[0] || null })} className="w-full text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-600 hover:file:bg-indigo-100 dark:file:bg-indigo-950 dark:file:text-indigo-300" />
              <p className="text-[11px] text-gray-400">Blueprint image (PNG/JPG). Large images are resized automatically to keep them manageable.</p>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? "Uploading…" : "Create Takeoff"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
