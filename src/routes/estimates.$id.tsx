import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { getEstimate, addLineItem, removeLineItem, updateEstimateStatus, getCurrentUser } from "~/lib/estimates";
import { logout } from "~/lib/auth";

export const Route = createFileRoute("/estimates/$id")({
  loader: async ({ params }) => {
    const { user } = await getCurrentUser();
    if (!user) throw new (await import("@tanstack/react-router")).redirect({ to: "/login" });
    const data = await getEstimate({ data: { id: params.id } });
    return { user, ...data };
  },
  component: EstimateDetail,
});

const UNITS = ["each", "hour", "foot", "sqft", "lump"];

function EstimateDetail() {
  const router = useRouter();
  const { user, estimate, lineItems } = Route.useLoaderData();
  const [desc, setDesc] = useState(""); const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("each"); const [cost, setCost] = useState("0");
  const [markup, setMarkup] = useState("0"); const [adding, setAdding] = useState(false);
  const [items, setItems] = useState(lineItems); const [status, setStatus] = useState(estimate.status);
  const handleLogout = async () => { await logout(); router.navigate({ to: "/" }); };
  const calcTotal = (item: any) => (item.quantity * item.unit_cost) * (1 + item.markup_percent / 100);
  const subtotal = items.reduce((s: number, i: any) => s + i.quantity * i.unit_cost, 0);
  const grandTotal = items.reduce((s: number, i: any) => s + calcTotal(i), 0);
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault(); if (!desc.trim()) return; setAdding(true);
    try {
      await addLineItem({ data: { estimateId: estimate.id, description: desc, quantity: parseFloat(qty) || 1, unit, unitCost: parseFloat(cost) || 0, markupPercent: parseFloat(markup) || 0 } });
      setDesc(""); setQty("1"); setUnit("each"); setCost("0"); setMarkup("0");
      const fresh = await getEstimate({ data: { id: estimate.id } }); setItems(fresh.lineItems);
    } catch (e) { console.error(e); } finally { setAdding(false); }
  };
  const handleRemoveItem = async (id: string) => { await removeLineItem({ data: { id } }); setItems(items.filter((i: any) => i.id !== id)); };
  const handleStatusChange = async (s: string) => { await updateEstimateStatus({ data: { id: estimate.id, status: s } }); setStatus(s); };
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</span>
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="text-gray-600 dark:text-gray-400">{user.email}</span>
            <Link to="/estimates" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Estimates</Link>
            <button onClick={handleLogout} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900">Sign Out</button>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <Link to="/estimates" className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">&larr; Back to estimates</Link>
        <div className="mt-4 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{estimate.project_name}</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">{estimate.customer_name} &middot; <span className="capitalize">{estimate.trade}</span></p>
          </div>
          <select value={status} onChange={e => handleStatusChange(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800">
            <option value="draft">Draft</option><option value="sent">Sent</option><option value="won">Won</option><option value="lost">Lost</option>
          </select>
        </div>
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Line Items</h2>
          {items.length === 0 ? <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No line items yet.</p> : (
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-950"><tr><th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Description</th><th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-right">Qty</th><th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Unit</th><th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-right">Unit Cost</th><th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-right">Markup</th><th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-right">Total</th><th></th></tr></thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                      <td className="px-4 py-3">{item.description}</td><td className="px-4 py-3 text-right">{item.quantity}</td><td className="px-4 py-3">{item.unit}</td><td className="px-4 py-3 text-right">${Number(item.unit_cost).toFixed(2)}</td><td className="px-4 py-3 text-right">{item.markup_percent}%</td><td className="px-4 py-3 text-right font-medium">${calcTotal(item).toFixed(2)}</td><td className="px-4 py-3 text-right"><button onClick={() => handleRemoveItem(item.id)} className="text-xs text-red-600 hover:text-red-500">Remove</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-950 font-medium">
                  <tr><td colSpan={4} className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">Subtotal</td><td></td><td className="px-4 py-3 text-right">${subtotal.toFixed(2)}</td><td></td></tr>
                  <tr className="text-lg"><td colSpan={4} className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">Total</td><td></td><td className="px-4 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">${grandTotal.toFixed(2)}</td><td></td></tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
        <form onSubmit={handleAddItem} className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-950">
          <h3 className="text-sm font-semibold">Add Line Item</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-6">
            <div className="sm:col-span-2"><input type="text" placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" required /></div>
            <div><input type="number" step="any" min="0" placeholder="Qty" value={qty} onChange={e => setQty(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" /></div>
            <div><select value={unit} onChange={e => setUnit(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800">{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
            <div><input type="number" step="0.01" min="0" placeholder="Unit Cost" value={cost} onChange={e => setCost(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" /></div>
            <div><input type="number" step="0.1" min="0" placeholder="Markup %" value={markup} onChange={e => setMarkup(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" /></div>
          </div>
          <button type="submit" disabled={adding} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{adding ? "Adding..." : "Add Item"}</button>
        </form>
      </main>
    </div>
  );
}
