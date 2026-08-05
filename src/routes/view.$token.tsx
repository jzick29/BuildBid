import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";

export const Route = createFileRoute("/view/$token")({ component: PortalEstimate });

function PortalEstimate() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [respondStatus, setRespondStatus] = useState<"approved" | "rejected" | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [responseError, setResponseError] = useState("");
  const [responseSuccess, setResponseSuccess] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentName, setCommentName] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "portal.getByToken", args: { data: { token } } }), credentials: "omit" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to load");
      setData(json); setAttachments(json.attachments || []); setComments(json.comments || []);
      if (json.responses && json.responses.length > 0) {
        const r = json.responses[0];
        setRespondStatus(r.status); setResponseMessage(r.message || "");
        if (r.signatureData) setSignatureData(r.signatureData);
        setResponseSuccess(`This estimate was ${r.status} on ${new Date(r.createdAt).toLocaleDateString()}.`);
      }
    } catch (e: any) { setError(e.message || "Could not load estimate"); setData(null); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { loadData(); }, [loadData]);

  // Canvas
  const initCanvas = () => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const r = c.getBoundingClientRect(); c.width = r.width * 2; c.height = r.height * 2;
    ctx.scale(2, 2); ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (signatureData) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height); img.src = signatureData; }
  };
  useEffect(() => { if (!loading && data) setTimeout(initCanvas, 100); }, [loading, data]);

  const getCoords = (e: any) => { const c = canvasRef.current; if (!c) return { x: 0, y: 0 }; const r = c.getBoundingClientRect(); if (e.touches) return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top }; return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const startDraw = (e: any) => { setIsDrawing(true); const { x, y } = getCoords(e); const ctx = canvasRef.current?.getContext("2d"); if (ctx) { ctx.beginPath(); ctx.moveTo(x, y); } };
  const draw = (e: any) => { if (!isDrawing) return; e.preventDefault(); const { x, y } = getCoords(e); const ctx = canvasRef.current?.getContext("2d"); if (ctx) { ctx.lineTo(x, y); ctx.stroke(); } };
  const endDraw = () => { setIsDrawing(false); const c = canvasRef.current; if (c) setSignatureData(c.toDataURL("image/png")); };
  const clearSig = () => { setSignatureData(null); const c = canvasRef.current; if (c) { const ctx = c.getContext("2d"); if (ctx) ctx.clearRect(0, 0, c.width, c.height); } };

  const handleSubmit = async () => {
    if (!respondStatus) return; setSubmitting(true); setResponseError("");
    try {
      const r = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "portal.submitResponse", args: { data: { token, status: respondStatus, message: responseMessage, signatureData: signatureData || "" } } }), credentials: "omit" });
      const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Failed");
      setResponseSuccess(`Estimate ${respondStatus}! Thank you.`);
    } catch (e: any) { setResponseError(e.message); } finally { setSubmitting(false); }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return; if (f.size > 5242880) { setResponseError("File exceeds 5MB"); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const r = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "portal.uploadAttachment", args: { data: { token, filename: f.name, dataUrl: ev.target?.result as string, sizeBytes: f.size } } }), credentials: "omit" });
        const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Upload failed");
        await loadData();
      } catch (e: any) { setResponseError(e.message); }
      finally { setUploading(false); }
    };
    reader.readAsDataURL(f);
  };

  const handleComment = async () => {
    if (!newComment.trim()) return; setPostingComment(true);
    try {
      const r = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "portal.addComment", args: { data: { token, authorName: commentName || "Customer", message: newComment } } }), credentials: "omit" });
      const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Failed");
      setNewComment(""); await loadData();
    } catch (e: any) { setResponseError(e.message); } finally { setPostingComment(false); }
  };

  const bc = data?.branding?.primaryColor || "#4f46e5";
  const already = !!responseSuccess;
  const subtotal = (data?.lineItems || []).reduce((s: number, li: any) => s + li.quantity * li.unitCost * (1 + li.markupPercent / 100), 0);

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><div className="animate-spin h-8 w-8 border-3 border-gray-300 border-t-indigo-600 rounded-full" /></div>;
  if (error || !data) return <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center"><div className="mb-4 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center"><svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg></div><h2 className="text-xl font-bold">{error || "Estimate not found"}</h2><p className="mt-2 text-gray-500">This link may have expired. Contact your contractor for a new one.</p><a href="/" className="mt-6 text-sm font-medium text-indigo-600">BuildBid Home</a></div>;

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <header className="border-b bg-white dark:bg-gray-900 dark:border-gray-800">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.branding?.logoUrl ? <img src={data.branding.logoUrl} alt="" className="h-8 w-8 rounded object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : null}
            <div><h1 className="text-lg font-bold" style={{ color: bc }}>{data.branding?.companyName || "BuildBid"}</h1><p className="text-xs text-gray-500">Estimate for {data.estimate.customerName}</p></div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${data.estimate.status === "won" ? "bg-green-100 text-green-700" : data.estimate.status === "lost" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{data.estimate.status === "won" ? "Approved" : data.estimate.status === "lost" ? "Rejected" : "Pending"}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800">
          <h2 className="text-xl font-bold">{data.estimate.projectName}</h2>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500"><span>Customer: {data.estimate.customerName}</span><span>Trade: {data.estimate.trade}</span></div>
          {data.estimate.notes && <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 border-t pt-4">{data.estimate.notes}</p>}
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800">
          <h3 className="font-bold mb-4">Line Items</h3>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-gray-500 dark:border-gray-700"><th className="pb-2 font-medium">Description</th><th className="pb-2 font-medium text-right">Qty</th><th className="pb-2 font-medium text-right">Unit</th><th className="pb-2 font-medium text-right">Cost</th><th className="pb-2 font-medium text-right">Markup</th><th className="pb-2 font-medium text-right">Total</th></tr></thead><tbody>{(data.lineItems || []).map((li: any) => { const t = li.quantity * li.unitCost * (1 + li.markupPercent / 100); return <tr key={li.id} className="border-b dark:border-gray-700"><td className="py-2">{li.description}</td><td className="py-2 text-right">{li.quantity}</td><td className="py-2 text-right">{li.unit}</td><td className="py-2 text-right">${li.unitCost.toFixed(2)}</td><td className="py-2 text-right">{li.markupPercent}%</td><td className="py-2 text-right font-medium">${t.toFixed(2)}</td></tr>; })}<tr className="font-bold"><td colSpan={5} className="pt-3 text-right">Total</td><td className="pt-3 text-right">${subtotal.toFixed(2)}</td></tr></tbody></table></div>
        </section>

        {attachments.length > 0 && <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800"><h3 className="font-bold mb-4">Attachments</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{attachments.map((a: any) => <div key={a.id} className="border rounded-lg overflow-hidden dark:border-gray-700"><div className="w-full h-32 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs text-gray-400">{a.filename}</div><p className="p-2 text-xs text-gray-500 truncate">{a.filename}</p></div>)}</div></section>}

        {!already && <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800"><h3 className="font-bold mb-3">Add Photos</h3><p className="text-sm text-gray-500 mb-3">Attach photos (max 5MB each).</p><input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" /><button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 disabled:opacity-50">{uploading ? <><span className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-indigo-600 rounded-full" /> Uploading...</> : <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> Upload Photo</>}</button></section>}

        {!already && <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800"><h3 className="font-bold mb-3">Digital Signature</h3><p className="text-sm text-gray-500 mb-3">Sign to confirm your response.</p><div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 overflow-hidden bg-white"><canvas ref={canvasRef} className="w-full h-48 touch-none cursor-crosshair" onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} /></div><div className="mt-2 flex gap-3"><button onClick={clearSig} className="text-sm text-gray-500 hover:text-gray-700">Clear</button>{signatureData && <span className="text-sm text-green-600">✓ Captured</span>}</div></section>}

        {!already && <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800"><h3 className="font-bold mb-3">Your Response</h3><div className="flex gap-3 mb-4"><button onClick={() => setRespondStatus(respondStatus === "approved" ? null : "approved")} className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold border-2 transition ${respondStatus === "approved" ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : "border-gray-200 hover:border-green-300 dark:border-gray-700"}`}>✓ Approve</button><button onClick={() => setRespondStatus(respondStatus === "rejected" ? null : "rejected")} className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold border-2 transition ${respondStatus === "rejected" ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400" : "border-gray-200 hover:border-red-300 dark:border-gray-700"}`}>✗ Decline</button></div><textarea value={responseMessage} onChange={e => setResponseMessage(e.target.value)} placeholder="Add a message (optional)..." rows={3} className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700" />{responseError && <p className="mt-2 text-sm text-red-600">{responseError}</p>}<button onClick={handleSubmit} disabled={!respondStatus || submitting} className="mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-50" style={{ backgroundColor: bc }}>{submitting ? "Submitting..." : `Submit ${respondStatus === "approved" ? "Approval" : "Rejection"}`}</button></section>}

        {already && <section className="rounded-xl bg-green-50 p-6 text-center dark:bg-green-950"><svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p className="mt-3 font-semibold text-green-800 dark:text-green-300">{responseSuccess}</p>{signatureData && <div className="mt-4 mx-auto max-w-xs"><p className="text-xs text-gray-500 mb-1">Your signature:</p><img src={signatureData} alt="Signature" className="border rounded-lg bg-white p-2" /></div>}</section>}

        <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800"><h3 className="font-bold mb-4">Discussion ({comments.length})</h3>{comments.length === 0 && <p className="text-sm text-gray-400">No comments yet.</p>}<div className="space-y-3 mb-4">{comments.map((c: any) => <div key={c.id} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800"><div className="flex items-center justify-between mb-1"><span className="text-sm font-semibold">{c.authorName}</span><span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</span></div><p className="text-sm text-gray-600 dark:text-gray-300">{c.message}</p></div>)}</div>{!already && <div className="space-y-2"><input value={commentName} onChange={e => setCommentName(e.target.value)} placeholder="Your name" className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700" /><textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Ask a question..." rows={2} className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700" /><button onClick={handleComment} disabled={postingComment || !newComment.trim()} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: bc }}>{postingComment ? "Posting..." : "Post Comment"}</button></div>}</section>

        <footer className="text-center text-xs text-gray-400 py-4">Powered by <a href="/" className="underline hover:text-gray-600">BuildBid</a></footer>
      </main>
    </div>
  );
}
