import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/portal/change-order/$id")({ component: PortalChangeOrderPage });

const statusLabels: Record<string, string> = { draft: "Draft", sent: "Awaiting Your Response", submitted: "Awaiting Your Response", approved: "Approved", rejected: "Rejected" };
const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  submitted: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};
function money(n: any): string { return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function PortalChangeOrderPage() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const [co, setCo] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responding, setResponding] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/portal/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) { navigate({ to: "/portal/login" }); return null; }
        return fetch("/api/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ function: "portal.getChangeOrder", args: { data: { id: params.id } } }),
          credentials: "include",
        });
      })
      .then((r) => r?.json())
      .then((d) => {
        if (!d?.changeOrder) { setError("This change order is not available to your account."); return; }
        setCo(d.changeOrder); setItems(d.items || []); setStatus(d.changeOrder.status);
      })
      .catch(() => setError("Something went wrong loading this change order."))
      .finally(() => setLoading(false));
  }, [params.id, navigate]);

  const total = items.reduce((sum: number, i: any) => sum + (i.quantity * i.unit_cost) * (1 + (i.markup_percent || 0) / 100), 0);

  const handleResponse = async (approved: boolean) => {
    if (!co) return;
    if (!approved && !reason.trim()) { setError("Please enter a reason for rejecting this change order."); return; }
    setResponding(true); setError("");
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "portal.respondChangeOrder", args: { data: { changeOrderId: co.id, approved, reason: reason.trim() } } }),
        credentials: "include",
      });
      const d = await res.json();
      if (res.ok && d.status) { setStatus(d.status); setRejecting(false); }
      else setError(d.error || "Failed to submit your response");
    } catch (err: any) { setError(err.message || "Failed to submit your response"); }
    finally { setResponding(false); }
  };

  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-gray-50 dark:bg-gray-950"><p className="text-sm text-gray-500">Loading…</p></div>;

  if (error && !co) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-6 dark:bg-gray-950">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-300">{error}</p>
          <Link to="/portal" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">← Back to portal</Link>
        </div>
      </div>
    );
  }

  const awaiting = status === "sent" || status === "submitted";

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <Link to="/portal" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">← Back to portal</Link>
            <p className="mt-1 text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">Change Order</p>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[status] || statusColors.draft}`}>{statusLabels[status] || status}</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8 pb-24">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{co.title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{co.project_name} · {co.customer_name}</p>
          {co.description && <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">{co.description}</p>}
          <div className="mt-6 space-y-2.5 text-sm">
            {items.length === 0 ? (
              <p className="text-gray-500">No line items on this change order.</p>
            ) : (
              items.map((item: any) => (
                <div key={item.id} className="flex items-start justify-between gap-3">
                  <span className="text-gray-700 dark:text-gray-200">{item.description}<span className="text-gray-400 dark:text-gray-500"> × {item.quantity} {item.unit}</span></span>
                  <span className="shrink-0 font-medium text-gray-900 dark:text-gray-100">${money((item.quantity * item.unit_cost) * (1 + (item.markup_percent || 0) / 100))}</span>
                </div>
              ))
            )}
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-800">
            <span className="font-semibold text-gray-900 dark:text-gray-100">Change Order Total</span>
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">${money(total)}</span>
          </div>
          {awaiting ? (
            <div className="mt-8">
              {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
              {rejecting && (
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                  <label htmlFor="reject-reason" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Reason for rejecting (required)</label>
                  <textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                    placeholder="Tell us what needs to change…" />
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row">
                {!rejecting ? (
                  <>
                    <button onClick={() => handleResponse(true)} disabled={responding} className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">✓ Approve</button>
                    <button onClick={() => setRejecting(true)} disabled={responding} className="flex-1 rounded-lg border border-red-300 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30">✗ Reject</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleResponse(false)} disabled={responding} className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{responding ? "Submitting…" : "Confirm Rejection"}</button>
                    <button onClick={() => { setRejecting(false); setReason(""); }} disabled={responding} className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Cancel</button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className={`mt-8 rounded-lg p-4 text-center text-sm font-medium ${status === "approved" ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"}`}>
              {status === "approved" ? "✓ You approved this change order" : "✗ You rejected this change order"}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
