import { createFileRoute, Link, useParams } from "@tanstack/react-router";

const plans: Record<string, { name: string; desc: string; features: string[]; monthly: number; annual: number }> = {
  starter: { name: "Starter", desc: "For solo operators", features: ["Single user", "Core estimating", "Basic templates"], monthly: 49, annual: 39 },
  pro: { name: "Pro", desc: "For growing teams", features: ["Up to 5 users", "Custom assemblies", "Branded proposals"], monthly: 99, annual: 79 },
  shop: { name: "Shop", desc: "For established shops", features: ["Unlimited users", "Job costing", "QuickBooks integration"], monthly: 199, annual: 159 },
};

export const Route = createFileRoute("/subscribe/$plan")({
  loader: async () => ({}),
  component: SubscribePage,
});

function SubscribePage() {
  const { plan: planId } = useParams({ from: "/subscribe/$plan" });
  const plan = plans[planId];

  if (!plan) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Plan not found</h1>
          <p className="mt-2 text-gray-500">The plan "{planId}" doesn't exist.</p>
          <Link to="/subscribe" className="mt-4 inline-block text-indigo-600 hover:text-indigo-500">View all plans</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            BuildBid
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Dashboard
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <div className="rounded-xl border border-gray-200 p-8 text-center dark:border-gray-800">
          <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            {plan.name}
          </span>
          <h1 className="mt-4 text-3xl font-bold">Subscribe to {plan.name}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{plan.desc}</p>
          <div className="mt-8">
            <p className="text-5xl font-bold">
              ${plan.monthly}<span className="text-base font-normal text-gray-500">/mo</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">or ${plan.annual}/mo billed annually — save 20%</p>
          </div>
          <ul className="mx-auto mt-8 max-w-xs space-y-3 text-left text-sm text-gray-600 dark:text-gray-400">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-indigo-600">✓</span> {f}
              </li>
            ))}
          </ul>
          <div className="mt-8 space-y-3">
            <Link
              to="/subscribe"
              className="block w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 text-center"
            >
              Subscribe Now — ${plan.monthly}/mo
            </Link>
            <Link
              to="/subscribe"
              className="block text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Compare all plans
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
