import { createFileRoute, Link } from "@tanstack/react-router";
import { getBlogStats } from "~/lib/blog";

export const Route = createFileRoute("/blog")({
  loader: async () => {
    const stats = await getBlogStats();
    return stats;
  },
  component: BlogPage,
  head: () => ({
    meta: [
      { title: "Blog — BuildBid | Construction Estimating Tips" },
      { name: "description", content: "Expert tips for trade contractors on estimating, bidding, and winning more profitable work." },
    ],
  }),
});

function BlogPage() {
  const { estimateCount } = Route.useLoaderData();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Home</Link>
            <Link to="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Start Free Trial</Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <article>
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Estimating Best Practices</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">5 Estimating Mistakes That Cost Trade Contractors Thousands</h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Most contractors lose money before they even step on the job site — right at the estimating table.
            Here's how to fix the most common pricing errors.
          </p>

          <div className="mt-10 space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">1. Guessing Instead of Using Assemblies</h2>
            <p>
              Every trade has repeatable work packages. A panel upgrade isn't just a breaker box — it's the panel,
              the breakers, the feeder wire, the grounding, the labor to disconnect and reconnect, and the permit.
              When you estimate from scratch every time, you forget something. Line-item assemblies capture everything
              once and let you reuse it forever. Contractors using assemblies report 30% fewer missed line items and
              20% higher margins.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">2. Not Tracking Win/Loss Data</h2>
            <p>
              If you don't know your win rate by trade, you're flying blind. Most contractors discover they win 80% of
              one type of job and 20% of another — but only after tracking. Once you know your numbers, you can adjust
              pricing, focus on profitable work, and stop bidding jobs you never win anyway.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">3. Using the Same Markup for Everything</h2>
            <p>
              A flat 20% markup across every line item is leaving money on the table. High-risk items (like trenching
              or working at height) should carry higher margins than commodity materials. Smart estimators apply tiered
              markups: 10-15% on materials, 25-40% on specialized labor, 50%+ on subcontracted work.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">4. Sending Unprofessional Proposals</h2>
            <p>
              Your proposal is often the only thing a customer sees before signing. A spreadsheet printed on
              company letterhead sends a message — and it's not "hire me." Professional, branded PDF proposals
              with clear line items, terms, and a total close 40% more often than plain spreadsheets. The good
              news: generating one takes seconds with the right tools.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">5. Not Using Historical Data to Price New Jobs</h2>
            <p>
              Your past estimates are a goldmine. What did that last furnace replacement actually cost? What was your
              average markup on won jobs last quarter? Contractors who reference historical data when pricing new bids
              are 2x more accurate on labor hours and 3x less likely to underbid.
            </p>
          </div>

          <div className="mt-12 rounded-xl bg-indigo-50 border border-indigo-200 p-8 text-center dark:bg-indigo-950/30 dark:border-indigo-800">
            <h2 className="text-xl font-bold text-indigo-900 dark:text-indigo-300">Stop estimating from scratch</h2>
            <p className="mt-2 text-indigo-700 dark:text-indigo-400">
              BuildBid gives you pre-built assemblies, professional proposals, and win/loss tracking — so you can
              focus on winning work, not fixing spreadsheets.
              {estimateCount > 0 && <> Join {estimateCount}+ estimates already created on the platform.</>}
            </p>
            <Link to="/signup" className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
              Start Free 14-Day Trial
            </Link>
            <p className="mt-3 text-xs text-indigo-500 dark:text-indigo-400">No credit card required</p>
          </div>
        </article>
      </main>

      <footer className="border-t border-gray-200 px-6 py-8 text-center text-sm text-gray-400 dark:border-gray-800 dark:text-gray-600">
        Built for trade contractors. &copy; {new Date().getFullYear()} BuildBid.
      </footer>
    </div>
  );
}
