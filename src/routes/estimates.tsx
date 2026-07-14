import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { listEstimates, deleteEstimate, getCurrentUser } from "~/lib/estimates";
import { logout } from "~/lib/auth";

export const Route = createFileRoute("/estimates")({
  loader: async () => {
    const { user } = await getCurrentUser();
    if (!user) throw new (await import("@tanstack/react-router")).redirect({ to: "/login" });
    const estimates = await listEstimates();
    return { user, estimates };
  },
  component: EstimatesList,
});

function EstimatesList() {
  const router = useRouter();
  const { user, estimates } = Route.useLoaderData();
  const [deleting, setDeleting] = useState<string | null>(null);
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this estimate?")) return;
    setDeleting(id);
    await deleteEstimate({ data: { id } });
    router.navigate({ to: "/estimates" });
  };
  const handleLogout = async () => { await logout(); router.navigate({ to: "/" }); };
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</span>
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="text-gray-600 dark:text-gray-400">{user.email}</span>
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Dashboard</Link>
            <button onClick={handleLogout} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900">Sign Out</button>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Estimates</h1>
          <Link to="/estimates/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">New Estimate</Link>
        </div>
        {estimates.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">No estimates yet.</p>
            <Link to="/estimates/new" className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">Create your first estimate</Link>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr><th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Project</th><th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Customer</th><th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Trade</th><th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th><th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-right">Total</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {estimates.map((e: any) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                    <td className="px-4 py-3"><Link to={`/estimates/${e.id}`} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">{e.project_name}</Link></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{e.customer_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 capitalize">{e.trade}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.status === 'won' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' : e.status === 'lost' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' : e.status === 'sent' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>{e.status}</span></td>
                    <td className="px-4 py-3 text-right font-medium">${Number(e.total).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right"><button onClick={() => handleDelete(e.id)} disabled={deleting === e.id} className="text-xs text-red-600 hover:text-red-500 disabled:opacity-50">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
