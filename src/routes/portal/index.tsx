import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/portal/")({ component: PortalDashboard });

const statusLabels: Record<string, string> = { draft: "Draft", sent: "Proposal Sent", signed: "Signed", won: "Won", lost: "Lost" };
const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  signed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  won: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  lost: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};
const coStatusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  submitted: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function PortalDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [changeOrders, setChangeOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) { navigate({ to: "/portal/login" }); return; }
        setUser(d.user);
        return fetch("/api/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ function: "portal.getDashboard", args: {} }),
          credentials: "include",
        });
      })
      .then((r) => r?.json())
      .then((d) => { if (d?.estimates) setEstimates(d.estimates); if (d?.changeOrders) setChangeOrders(d.changeOrders); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogout = async () => { await fetch("/api/portal/logout", { method: "POST", credentials: "include" }); navigate({ to: "/portal/login" }); };

  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-gray-50 dark:bg-gray-950"><p className="text-sm text-gray-500">Loading…</p></div>;

  const pendingActions = changeOrders.filter((co: any) => co.status === "sent" || co.status === "submitted").length;

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-lg font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Customer Portal</p>
          </div>
          <div className="flex items-center gap-3">
            {user && <span className="hidden text-sm text-gray-600 dark:text-gray-300 sm:block">{user.company_name || user.name || user.email}</span>}
            <button onClick={handleLogout} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Sign Out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8 pb-24">
        <h1 className="text-2xl font-bold tracking-tight">{user?.company_name || user?.name ? `Welcome, ${user?.company_name || user?.name}` : "Welcome"}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Here are your proposals and change orders.</p>
        {pendingActions > 0 && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <span className="font-semibold">{pendingActions} change order{pendingActions === 1 ? "" : "s"} awaiting your approval.</span> Review them below.
          </div>
        )}
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Proposals</h2>
          {estimates.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700"><p className="text-sm text-gray-500">No proposals have been shared with you yet.</p></div>
          ) : (
            <div className="mt-4 space-y-3">
              {estimates.map((est: any) => (
                <Link key={est.id} to="/portal/estimate/$id" params={{ id: est.id }}
                  className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{est.project_name}</p>
                      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{est.customer_name} · {est.trade}{est.change_order_count > 0 && ` · ${est.change_order_count} change order${est.change_order_count === 1 ? "" : "s"}`}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[est.status] || statusColors.draft}`}>{statusLabels[est.status] || est.status}</span>
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">${Number(est.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Change Orders</h2>
          {changeOrders.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700"><p className="text-sm text-gray-500">No change orders yet.</p></div>
          ) : (
            <div className="mt-4 space-y-3">
              {changeOrders.map((co: any) => (
                <Link key={co.id} to="/portal/change-order/$id" params={{ id: co.id }}
                  className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{co.title}</p>
                      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{co.project_name}{co.description ? ` · ${co.description.slice(0, 60)}${co.description.length > 60 ? "…" : ""}` : ""}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${coStatusColors[co.status] || coStatusColors.draft}`}>{co.status}</span>
                      {(co.total_cost != null && co.total_cost > 0) && <span className="text-sm font-bold text-gray-900 dark:text-gray-100">${Number(co.total_cost).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
