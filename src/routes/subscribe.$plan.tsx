import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "~/lib/auth";
import { getStripeLink, getPlanPrices } from "~/lib/subscriptions";

const plans = [
  { id: "starter", name: "Starter", desc: "For solo operators", features: ["Single user", "Core estimating", "Basic templates"] },
  { id: "pro", name: "Pro", desc: "For growing teams", features: ["Up to 5 users", "Custom assemblies", "Branded proposals"] },
  { id: "shop", name: "Shop", desc: "For established shops", features: ["Unlimited users", "Job costing", "QuickBooks integration"] },
];

export const Route = createFileRoute("/subscribe/$plan")({
  loader: async ({ params }) => {
    const plan = plans.find(p => p.id === params.plan);
    if (!plan) throw redirect({ to: "/" });
    const user = await getCurrentUser();
    if (!user.user) throw redirect({ to: "/login" });
    const prices = getPlanPrices(params.plan);
    return { plan, prices, user: user.user, stripeLink: getStripeLink(params.plan) };
  },
  component: SubscribePage,
});

function SubscribePage() {
  const { plan, prices, user, stripeLink } = Route.useLoaderData();

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

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <div className="rounded-xl border border-gray-200 p-8 text-center dark:border-gray-800">
          <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            {plan.name}
          </span>
          <h1 className="mt-4 text-3xl font-bold">Subscribe to {plan.name}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{plan.desc}</p>

          <div className="mt-8">
            <p className="text-5xl font-bold">
              ${prices.monthly}<span className="text-base font-normal text-gray-500">/mo</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">or ${prices.annual}/mo billed annually — save 20%</p>
          </div>

          <ul className="mx-auto mt-8 max-w-xs space-y-3 text-left text-sm text-gray-600 dark:text-gray-400">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-indigo-600">✓</span> {f}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-gray-400">
            Signed in as {user.email}
          </p>

          <div className="mt-8 space-y-3">
            <a
              href={stripeLink}
              className="block w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 text-center"
            >
              Subscribe Now — ${prices.monthly}/mo
            </a>
            <Link
              to="/"
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