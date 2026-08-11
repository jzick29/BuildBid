import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/co/$id")({
  component: CoPage,
});

function CoPage() {
  const params = Route.useParams() as { id: string } | undefined;
  const id = params?.id;
  const [changeOrder, setChangeOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responding, setResponding] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!id) { setError("Missing change order id."); setLoading(false); return; }
    fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "changeOrderWorkflow.getPublicChangeOrder", args: { data: { id } } }),
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error || !d?.changeOrder) { setError(d?.error || "This change order could not be found."); return; }
        setChangeOrder(d.changeOrder);
        setItems(d.items || []);
        setStatus(d.changeOrder.status);
      })
      .catch(() => setError("Something went wrong loading this change order."))
      .finally(() => setLoading(false));
  }, [id]);

  const total = items.reduce((sum: number, i: any) => sum + (i.quantity * i.unit_cost) * (1 + (i.markup_percent || 0) / 100), 0);

  const handleResponse = async (approved: boolean) => {
    if (!changeOrder) return;
    setResponding(true);
    setError("");
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "changeOrderWorkflow.approveChangeOrder", args: { data: { changeOrderId: changeOrder.id, approved } } }),
        credentials: "include",
      });
      const d = await res.json();
      if (d?.error) { setError(d.error); return; }
      setStatus(d?.status || (approved ? "approved" : "rejected"));
    } catch (e) {
      setError("Something went wrong submitting your response.");
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-6 py-12">
        <div className="rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading change order…</p>
        </div>
      </div>
    );
  }

  if (error || !changeOrder) {
    return (
      <div className="mx-auto max-w-lg px-6 py-12">
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-xl font-bold">Change Order</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{error || "This change order could not be found."}</p>
        </div>
      </div>
    );
  }

  const canRespond = status === "sent" || status === "submitted";

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <div className="rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-xl font-bold">Change Order</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{changeOrder.project_name} · {changeOrder.customer_name}</p>
        <h2 className="mt-3 text-lg font-semibold">{changeOrder.title}</h2>
        {changeOrder.description && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{changeOrder.description}</p>}
        <div className="mt-6 space-y-2 text-sm">
          {items.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No line items on this change order.</p>
          ) : (
            items.map((item: any) => (
              <div key={item.id} className="flex justify-between">
                <span>{item.description} × {item.quantity} {item.unit}</span>
                <span className="font-medium">${(item.quantity * item.unit_cost * (1 + (item.markup_percent || 0) / 100)).toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
        <p className="mt-4 text-right text-lg font-bold text-indigo-600 dark:text-indigo-400">${total.toFixed(2)}</p>
        {canRespond ? (
          <div className="mt-8 flex gap-3">
            <button onClick={() => handleResponse(true)} disabled={responding} className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              ✓ Approve
            </button>
            <button onClick={() => handleResponse(false)} disabled={responding} className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              ✗ Reject
            </button>
          </div>
        ) : (
          <div className={`mt-8 rounded-lg p-4 text-center text-sm font-medium ${status === "approved" ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"}`}>
            {status === "approved" ? "✓ Approved" : status === "rejected" ? "✗ Rejected" : "This change order is no longer awaiting a response."}
          </div>
        )}
        {error && <p className="mt-3 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
