import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "~/lib/auth";

const getPlanFromQuery = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { plan?: string })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    if (!user.user) throw redirect({ to: "/login" });
    return { plan: data.plan || "starter" };
  });

export const Route = createFileRoute("/subscribe/success")({
  component: SuccessPage,
});

function SuccessPage() {
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
        <div className="rounded-xl border border-green-200 bg-green-50 p-12 text-center dark:border-green-900 dark:bg-green-950/30">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="mt-6 text-2xl font-bold text-green-800 dark:text-green-300">Subscription Successful!</h1>
          <p className="mt-2 text-green-700 dark:text-green-400">
            Welcome to BuildBid! Your account has been upgraded. You now have full access to all features.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              to="/dashboard"
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Go to Dashboard
            </Link>
            <Link
              to="/estimates/new"
              className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
            >
              Create an Estimate
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}