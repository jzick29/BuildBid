import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "~/lib/auth";
import { getCustomerList } from "~/lib/customers";

export const Route = createFileRoute("/customers")({
  loader: async () => {
    const { user } = await getCurrentUser();
    if (!user) throw redirect({ to: "/login" });
    const customers = await getCustomerList();
    return { user, customers };
  },
  component: CustomersPage,
});

function CustomersPage() {
  const { user, customers } = Route.useLoaderData();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</Link>
          <div className="flex items-center gap-6 text-sm font-medium">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Dashboard</Link>
            <Link to="/estimates" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Estimates</Link>
            <Link to="/customers" className="font-semibold text-indigo-600 dark:text-indigo-400">Customers</Link>
            <span className="text-gray-600 dark:text-gray-400">{user.email}</span>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">{customers.length} unique customers</p>

        <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Customer</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Total Bids</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Won</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Revenue</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Last Bid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {customers.map((c: any) => (
                <tr key={c.customer_name} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{c.customer_name}</td>
                  <td className="px-4 py-3 text-center">{c.total_estimates}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-medium text-green-600 dark:text-green-400">{c.won}</span>
                    {c.lost > 0 && <span className="ml-1 text-red-500 dark:text-red-400">/ {c.lost} lost</span>}
                  </td>
                  <td className="px-4 py-3 text-center font-medium">${(c.total_revenue || 0).toLocaleString("en-US")}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.last_bid ? new Date(c.last_bid).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
