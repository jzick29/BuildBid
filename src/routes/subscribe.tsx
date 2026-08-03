import { createFileRoute, Link } from "@tanstack/react-router";
import { getCurrentUser } from "~/lib/auth";
import { getStripeLink, getPlanPrices } from "~/lib/subscriptions";

const plans = [
  {
    id: "starter", name: "Starter", desc: "For solo operators",
    price: "$49", annual: "$39",
    features: ["Single user", "Core estimating with line items", "Basic templates", "Photo attachments", "Email proposals"],
    stripeLink: getStripeLink("starter"),
    highlight: false,
  },
  {
    id: "pro", name: "Pro", desc: "For growing teams",
    price: "$99", annual: "$79",
    features: ["Up to 5 users", "Everything in Starter", "Custom assemblies & templates", "Branded PDF proposals", "Change orders"],
    stripeLink: getStripeLink("pro"),
    highlight: true,
  },
  {
    id: "shop", name: "Shop", desc: "For established shops",
    price: "$199", annual: "$159",
    features: ["Unlimited users", "Everything in Pro", "Job costing & analytics", "QuickBooks integration", "Priority support"],
    stripeLink: getStripeLink("shop"),
    highlight: false,
  },
];

export const Route = createFileRoute("/subscribe")({
  loader: async () => {
    const result = await getCurrentUser();
    return { user: result.user };
  },
  component: PlansPage,
});

function PlansPage() {
  const { user } = Route.useLoaderData();
  const currentTier = user?.subscriptionTier || "trial";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</Link>
          <div className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Dashboard</Link>
                <span className="text-gray-500">{user.email}</span>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Sign in</Link>
                <Link to="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Start free trial</Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">Simple, transparent pricing</h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            14-day free trial — no credit card required. Upgrade anytime.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = currentTier === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-8 ${
                  plan.highlight
                    ? "border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800 shadow-lg"
                    : "border-gray-200 dark:border-gray-800"
                } bg-white dark:bg-gray-900`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                )}
                <div className="text-center">
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{plan.desc}</p>
                  <p className="mt-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-500">/mo</span>
                  </p>
                  <p className="text-xs text-gray-400">or {plan.annual}/mo billed annually</p>
                </div>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <svg className="h-4 w-4 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  {isCurrent ? (
                    <div className="rounded-lg bg-green-100 py-3 text-center text-sm font-semibold text-green-800 dark:bg-green-950 dark:text-green-300">
                      ✓ Current Plan
                    </div>
                  ) : (
                    <a
                      href={plan.stripeLink}
                      className={`block w-full rounded-lg py-3 text-center text-sm font-semibold transition ${
                        plan.highlight
                          ? "bg-indigo-600 text-white hover:bg-indigo-700"
                          : "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      }`}
                    >
                      {currentTier === "trial" ? "Subscribe" : "Upgrade"} to {plan.name}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All plans include a 14-day free trial. Cancel anytime.
            {!user && (
              <>{" "}<Link to="/signup" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">Get started →</Link></>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
