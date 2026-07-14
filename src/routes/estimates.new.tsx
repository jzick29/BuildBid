import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { createEstimate, getCurrentUser } from "~/lib/estimates";

export const Route = createFileRoute("/estimates/new")({
  loader: async () => {
    const { user } = await getCurrentUser();
    if (!user) throw new (await import("@tanstack/react-router")).redirect({ to: "/login" });
    return { user };
  },
  component: NewEstimate,
});

const TRADES = ["electrical", "plumbing", "hvac", "roofing", "general", "other"];

function NewEstimate() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [trade, setTrade] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const result = await createEstimate({ data: { projectName, customerName, trade } });
      router.navigate({ to: `/estimates/${result.id}` });
    } catch (err: any) { setError(err.message || "Failed"); } finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/estimates" className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">&larr; Back to estimates</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">New Estimate</h1>
      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">{error}</div>}
        <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Project Name</label><input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" required /></div>
        <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</label><input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" required /></div>
        <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Trade</label><select value={trade} onChange={e => setTrade(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" required><option value="">Select trade...</option>{TRADES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></div>
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{loading ? "Creating..." : "Create Estimate"}</button>
      </form>
    </div>
  );
}
