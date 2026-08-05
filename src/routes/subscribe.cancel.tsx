import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/subscribe/cancel")({
  component: CancelPage,
});

function CancelPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            BuildBid
          </span>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Dashboard
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-6 py-16">
        <div className="rounded-xl border border-gray-200 p-12 text-center dark:border-gray-800">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="mt-6 text-2xl font-bold">Checkout Cancelled</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            No worries — your account remains on the Free plan. You can subscribe anytime.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              to="/"
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              View Plans
            </Link>
            <Link
              to="/dashboard"
              className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}