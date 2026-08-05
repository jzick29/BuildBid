import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";

export const Route = createFileRoute("/sign/$estimateId")({
  loader: async () => ({}),
  component: SignPage,
});

function SignPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [signed, setSigned] = useState(!!estimate.signature_data);
  const [depositUrl, setDepositUrl] = useState<string | null>(null);
  const [creatingDeposit, setCreatingDeposit] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (estimate.signature_data) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => ctx?.drawImage(img, 0, 0);
      img.src = estimate.signature_data;
    }
  }, []);

  const startDraw = (e: any) => {
    setDrawing(true);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top;
    ctx.beginPath(); ctx.moveTo(x, y);
  };

  const draw = (e: any) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top;
    ctx.lineWidth = 2; ctx.strokeStyle = "#000"; ctx.lineTo(x, y); ctx.stroke();
  };

  const handlePayDeposit = async () => {
    const depositAmount = total * 0.1; // 10% deposit
    setCreatingDeposit(true);
    try {
      const result = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "payments.createDepositLink", args: { data: { estimateId: estimate.id, amount: depositAmount, description: `Deposit for ${estimate.project_name}` } } }), credentials: "include" }).then(r => r.json());
      setDepositUrl(result.url);
      window.open(result.url, "_blank");
    } catch (e: any) { alert("Payment not available: " + e.message); }
    finally { setCreatingDeposit(false); }
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "materials.savePublicSignature", args: { data: { estimateId: estimate.id, signature: canvas.toDataURL("image/png") } } }), credentials: "include" });
      setSigned(true);
    } catch (e) {}
    finally { setSaving(false); }
  };

  const total = items.reduce((sum: number, i: any) => sum + (i.quantity * i.unit_cost * (1 + i.markup_percent / 100)), 0);

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <div className="rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-xl font-bold">{estimate.project_name}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Prepared for {estimate.customer_name}</p>
        <p className="mt-4 text-2xl font-bold text-indigo-600 dark:text-indigo-400">${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
        <div className="mt-6 border-t pt-4">
          <p className="text-sm text-gray-500">Deposit (10%)</p>
          <p className="text-lg font-semibold">${(total * 0.1).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          {!depositUrl ? (
            <button onClick={handlePayDeposit} disabled={creatingDeposit}
              className="mt-2 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {creatingDeposit ? "Creating..." : "💳 Pay Deposit"}
            </button>
          ) : (
            <div className="mt-2 text-sm">
              <a href={depositUrl} target="_blank" className="text-indigo-600 hover:underline">Payment link opened</a>
              <button onClick={() => navigator.clipboard.writeText(depositUrl!)}
                className="ml-2 px-2 py-0.5 border rounded text-xs hover:bg-gray-50">Copy</button>
            </div>
          )}
        </div>
        <div className="mt-8">
          <h3 className="text-sm font-semibold">Line Items</h3>
          <div className="mt-3 space-y-2 text-sm">
            {items.map((item: any) => (
              <div key={item.id} className="flex justify-between">
                <span>{item.description} × {item.quantity} {item.unit}</span>
                <span className="font-medium">${(item.quantity * item.unit_cost * (1 + item.markup_percent / 100)).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10">
          <h3 className="text-sm font-semibold mb-3">Signature</h3>
          {signed ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-sm text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
              ✓ Signed — thank you!
            </div>
          ) : (
            <>
              <canvas ref={canvasRef} width={400} height={150}
                className="w-full rounded-lg border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800"
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={() => setDrawing(false)} onMouseLeave={() => setDrawing(false)}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={() => setDrawing(false)}
              />
              <div className="mt-3 flex gap-3">
                <button onClick={handleSave} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? "Saving..." : "Sign & Accept"}
                </button>
                <button onClick={() => { const c = canvasRef.current; if (c) { const ctx = c.getContext("2d")!; ctx.clearRect(0, 0, c.width, c.height); } }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Clear</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
