import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/contracts")({ component: ContractsPage });

function ContractsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [expiring, setExpiring] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        const meData = await meRes.json();
        if (!meData.user) { window.location.href = "/login"; return; }
        setUser(meData.user);
        const [c, e] = await Promise.all([
          fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "contracts.listContracts", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []),
          fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "contracts.getExpiringContracts", args: {} }), credentials: "include" }).then(r => r.json()).catch(() => []),
        ]);
        setContracts(c); setExpiring(e);
      } catch (err: any) { setError(err.message); }
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
            <Link to="/contracts" className="font-semibold text-indigo-600 dark:text-indigo-400">Contracts</Link>
            <span className="text-gray-600 dark:text-gray-400">{user.email}</span>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between"><h1 className="text-3xl font-bold tracking-tight">Contracts</h1></div>
        {expiring.length > 0 && <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/30"><p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">{expiring.length} contract{expiring.length>1?"s":""} expiring soon</p></div>}
        {contracts.length === 0 ? <div className="mt-10 rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700"><p className="text-gray-500">No contracts yet</p></div> : (
          <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800"><table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-950"><tr><th className="px-4 py-3 text-left font-medium text-gray-500">Customer</th><th className="px-4 py-3 text-left font-medium text-gray-500">Project</th><th className="px-4 py-3 text-left font-medium text-gray-500">Frequency</th><th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th><th className="px-4 py-3 text-left font-medium text-gray-500">Next Visit</th></tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-800">{contracts.map((c: any) => <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-950"><td className="px-4 py-3 font-medium">{c.customer_name}</td><td className="px-4 py-3">{c.project_name}</td><td className="px-4 py-3 capitalize">{c.frequency}</td><td className="px-4 py-3 text-right">${Number(c.amount||0).toLocaleString()}</td><td className="px-4 py-3 text-gray-500">{c.next_visit_date ? new Date(c.next_visit_date).toLocaleDateString() : "—"}</td></tr>)}</tbody></table></div>
        )}
      </main>
    </div>
  );
}
