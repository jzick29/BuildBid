import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const getServerTime = createServerFn({ method: "GET" }).handler(async () => {
  return { serverTime: new Date().toISOString(), version: "0.1.0" };
});

export const Route = createFileRoute("/dashboard")({
  loader: () => getServerTime(),
  component: Dashboard,
});

function Dashboard() {
  const data = Route.useLoaderData();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            BuildBid
          </span>
          <div className="flex items-center gap-6 text-sm font-medium text-gray-600 dark:text-gray-400">
            <span className="text-gray-900 dark:text-gray-100">Dashboard</span>
            <Link to="/" className="hover:text-gray-900 dark:hover:text-gray-100">
              Home
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Welcome to BuildBid. You're running v{data.version}.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Server time: {data.serverTime}
        </p>

        {/* Feature placeholder cards */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-950">
            <h2 className="text-lg font-semibold">Estimates</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Create and manage your estimates. Coming soon.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-950">
            <h2 className="text-lg font-semibold">Templates</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Build reusable estimate templates. Coming soon.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-950">
            <h2 className="text-lg font-semibold">Proposals</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Generate branded proposals. Coming soon.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
