import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { listAllChangeOrders } from "~/lib/change-order-workflow";

export const Route = createFileRoute("/change-orders")({ component: ChangeOrdersPage });

function ChangeOrdersPage() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        const meData = await meRes.json();
        if (!meData.user) { window.location.href = "/login"; return; }
        setUser(meData.user);
        const o = await listAllChangeOrders().catch(() => []);
        setOrders(o);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">Error: {error}</p></div>;
  if (!user) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</Link>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Dashboard</Link>
            <Link to="/change-orders" className="font-semibold text-indigo-600 dark:text-indigo-400">Change Orders</Link>
            <span className="text-gray-600 dark:text-gray-400">{user.email}</span>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Change Orders</h1>
        {orders.length === 0 ? <div className="mt-10 rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700"><p className="text-gray-500">No change orders yet</p></div> : (
          <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800"><table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-950"><tr><th className="px-4 py-3 text-left font-medium text-gray-500">Title</th><th className="px-4 py-3 text-left font-medium text-gray-500">Status</th><th className="px-4 py-3 text-right font-medium text-gray-500">Total</th><th className="px-4 py-3 text-left font-medium text-gray-500">Created</th></tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-800">{orders.map((o: any) => <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-950"><td className="px-4 py-3 font-medium">{o.title}</td><td className="px-4 py-3 capitalize"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium dark:bg-gray-800">{o.status||"draft"}</span></td><td className="px-4 py-3 text-right">${Number(o.total||0).toLocaleString()}</td><td className="px-4 py-3 text-gray-500">{o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}</td></tr>)}</tbody></table></div>
        )}
      </main>
    </div>
  );
}
