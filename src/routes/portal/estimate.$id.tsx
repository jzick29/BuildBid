import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/portal/estimate/$id")({ component: PortalEstimatePage });

const statusLabels: Record<string, string> = { draft: "Draft", sent: "Proposal Sent", signed: "Signed", won: "Won", lost: "Lost" };
function money(n: any): string { return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function PortalEstimatePage() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  const [estimate, setEstimate] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [proposals, setProposals] = useState<any[]>([]);
  const [changeOrders, setChangeOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(false);
  const [savingSig, setSavingSig] = useState(false);
  const [signedByName, setSignedByName] = useState("");

  useEffect(() => {
    fetch("/api/portal/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) { navigate({ to: "/portal/login" }); return null; }
        setSignedByName(d.user.name || d.user.email || "");
        return fetch("/api/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ function: "portal.getEstimate", args: { data: { estimateId: params.id } } }),
          credentials: "include",
        });
      })
      .then((r) => r?.json())
      .then((d) => {
        if (!d?.estimate) { setError("This proposal is not available to your account."); return; }
        setEstimate(d.estimate); setItems(d.lineItems || []); setTotal(d.total || 0);
        setProposals(d.proposals || []); setChangeOrders(d.changeOrders || []);
        setSigned(!!d.estimate.signed_at);
      })
      .catch(() => setError("Something went wrong loading this proposal."))
      .finally(() => setLoading(false));
  }, [params.id, navigate]);

  const getCoords = (e: any) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches && e.touches.length > 0) return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };
  const startDraw = (e: any) => { e.preventDefault(); const c = canvasRef.current!; const ctx = c.getContext("2d")!; const { x, y } = getCoords(e); ctx.beginPath(); ctx.moveTo(x, y); drawingRef.current = true; };
  const draw = (e: any) => { if (!drawingRef.current) return; e.preventDefault(); const c = canvasRef.current!; const ctx = c.getContext("2d")!; const { x, y } = getCoords(e); ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1e293b"; ctx.lineTo(x, y); ctx.stroke(); };
  const stopDraw = () => { drawingRef.current = false; };
  const clearCanvas = () => { const c = canvasRef.current; if (!c) return; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); };
  const handleSign = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    if (dataUrl.length < 2000) { setError("Please draw your signature before signing."); return; }
    setSavingSig(true); setError("");
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "portal.signEstimate", args: { data: { estimateId: estimate.id, signatureData: dataUrl, signedByName } } }),
        credentials: "include",
      });
      const d = await res.json();
      if (res.ok && d.success) setSigned(true);
      else setError(d.error || "Failed to save signature");
    } catch (err: any) { setError(err.message || "Failed to save signature"); }
    finally { setSavingSig(false); }
  };

  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-gray-50 dark:bg-gray-950"><p className="text-sm text-gray-500">Loading…</p></div>;

  if (error && !estimate) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-6 dark:bg-gray-950">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-300">{error}</p>
          <Link to="/portal" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">← Back to portal</Link>
        </div>
      </div>
    );
  }

  const latestPdf = proposals.find((p: any) => p.pdf_data) || null;

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <Link to="/portal" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">← Back to portal</Link>
            <p className="mt-1 text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">{estimate.project_name}</p>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estimate.signed_at ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"}`}>{statusLabels[estimate.status] || estimate.status}</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8 pb-24">
        {latestPdf && (
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Proposal Document</h2>
              <a href={`data:application/pdf;base64,${latestPdf.pdf_data}`} download={`${estimate.project_name || "proposal"}-${latestPdf.proposal_number || ""}.pdf`.replace(/\s+/g, "-")}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">Download PDF</a>
            </div>
            <iframe title="Proposal PDF" src={`data:application/pdf;base64,${latestPdf.pdf_data}`} className="h-[480px] w-full bg-gray-100 dark:bg-gray-800" />
          </section>
        )}
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Estimate Summary</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="pb-2 pr-4 font-semibold">Description</th>
                  <th className="pb-2 pr-4 text-right font-semibold">Qty</th>
                  <th className="pb-2 pr-4 text-right font-semibold">Unit</th>
                  <th className="pb-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => (
                  <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800/60">
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{item.description}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-600 dark:text-gray-300">{item.quantity}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-600 dark:text-gray-300">{item.unit}</td>
                    <td className="py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">${money((item.quantity * item.unit_cost) * (1 + (item.markup_percent || 0) / 100))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-800">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Total Proposal Amount</span>
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">${money(total)}</span>
          </div>
        </section>
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sign & Accept</h2>
          {signed ? (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-center text-sm text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
              ✓ Signed on {estimate.signed_at ? new Date(estimate.signed_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
              {estimate.signature_data && <div className="mx-auto mt-3 max-w-xs rounded border border-green-200 bg-white p-2 dark:border-green-800"><img src={estimate.signature_data} alt="Your signature" className="mx-auto h-16" /></div>}
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">By signing, you agree to the proposal amount and scope described above.</p>
              <div className="mt-4">
                <label htmlFor="signed-by" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Your name</label>
                <input id="signed-by" type="text" value={signedByName} onChange={(e) => setSignedByName(e.target.value)}
                  className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" placeholder="Jane Doe" />
              </div>
              <div className="mt-4 rounded-lg border-2 border-dashed border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
                <canvas ref={canvasRef} width={560} height={180} className="w-full touch-none" style={{ aspectRatio: "560/180", cursor: "crosshair" }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button onClick={handleSign} disabled={savingSig} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{savingSig ? "Saving…" : "Sign & Accept"}</button>
                <button onClick={clearCanvas} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Clear</button>
              </div>
              {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
            </>
          )}
        </section>
        {changeOrders.length > 0 && (
          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Change Orders</h2>
            <div className="mt-3 space-y-2">
              {changeOrders.map((co: any) => (
                <Link key={co.id} to="/portal/change-order/$id" params={{ id: co.id }}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{co.title}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{co.status}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
