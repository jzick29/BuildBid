import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

const PLANS = {
  monthly: {
    starter: 49,
    pro: 99,
    shop: 199,
  },
  annual: {
    starter: 39,
    pro: 79,
    shop: 159,
  },
};

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [annual, setAnnual] = useState(false);
  const prices = annual ? PLANS.annual : PLANS.monthly;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Nav */}
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            BuildBid
          </span>
          <div className="flex items-center gap-6 text-sm font-medium text-gray-600 dark:text-gray-400">
            <a href="#features" className="hover:text-gray-900 dark:hover:text-gray-100">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-gray-900 dark:hover:text-gray-100">
              How It Works
            </a>
            <a href="#pricing" className="hover:text-gray-900 dark:hover:text-gray-100">
              Pricing
            </a>
            <Link
              to="/signup"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl">
          Win more profitable work with{" "}
          <span className="text-indigo-600 dark:text-indigo-400">less overhead</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-gray-600 dark:text-gray-400">
          BuildBid replaces spreadsheets and pen-and-paper with line-item assemblies,
          professional proposals, and job tracking — built for trade contractors.
        </p>
        <div className="mt-10 flex gap-4">
          <Link
            to="/signup"
            className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Start Estimating Free
          </Link>
          <a
            href="#features"
            className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
          >
            See Features
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-gray-200 bg-gray-50 px-6 py-20 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">Everything you need to bid smarter</h2>
          <p className="mt-4 text-center text-gray-600 dark:text-gray-400">
            Purpose-built for trade contractors who are done with spreadsheets.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950">
                <svg className="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Line-Item Assemblies</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Pre-built cost databases by trade with customizable templates. Go from hours to minutes on every bid.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950">
                <svg className="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Professional Proposals</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Turn estimates into branded, customer-ready proposals in one click. No more reformatting.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950">
                <svg className="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Win/Loss Tracking</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Track estimates through won and lost, with actual-vs-estimated costs to sharpen future bids.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">Simple, transparent pricing</h2>
          <p className="mt-4 text-center text-gray-600 dark:text-gray-400">
            Start free for 14 days. No credit card required.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 flex items-center justify-center gap-3 text-sm">
            <span className={`font-medium ${annual ? "text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>
              Monthly
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={annual}
              onClick={() => setAnnual(!annual)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${annual ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-700"}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${annual ? "translate-x-5" : "translate-x-0"}`} />
            </button>
            <span className={`font-medium ${annual ? "text-gray-900 dark:text-gray-100" : "text-gray-400"}`}>
              Annual{" "}
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-950 dark:text-green-400">
                Save 20%
              </span>
            </span>
          </div>

          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
              <h3 className="text-lg font-semibold">Starter</h3>
              <p className="mt-2 text-3xl font-bold">
                ${prices.starter}<span className="text-base font-normal text-gray-500">/{annual ? "mo billed annually" : "mo"}</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">✓ Single user</li>
                <li className="flex items-center gap-2">✓ Core estimating</li>
                <li className="flex items-center gap-2">✓ Basic templates</li>
              </ul>
              <a
                href="https://buy.stripe.com/dRmaEZ7ej5np8B8g5t57W0o"
                className="mt-6 block w-full rounded-lg bg-gray-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
              >
                Subscribe — ${prices.starter}/mo
              </a>
            </div>
            <div className="rounded-xl border-2 border-indigo-600 bg-indigo-50 p-6 dark:border-indigo-500 dark:bg-indigo-950">
              <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">Popular</span>
              <h3 className="mt-2 text-lg font-semibold">Pro</h3>
              <p className="mt-2 text-3xl font-bold">
                ${prices.pro}<span className="text-base font-normal text-gray-500">/{annual ? "mo billed annually" : "mo"}</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">✓ Up to 5 users</li>
                <li className="flex items-center gap-2">✓ Custom assemblies</li>
                <li className="flex items-center gap-2">✓ Branded proposals</li>
              </ul>
              <a
                href="https://buy.stripe.com/8x29AVgOT4jl04C5qP57W0o"
                className="mt-6 block w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                Subscribe — ${prices.pro}/mo
              </a>
            </div>
            <div className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
              <h3 className="text-lg font-semibold">Shop</h3>
              <p className="mt-2 text-3xl font-bold">
                ${prices.shop}<span className="text-base font-normal text-gray-500">/{annual ? "mo billed annually" : "mo"}</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">✓ Unlimited users</li>
                <li className="flex items-center gap-2">✓ Job costing</li>
                <li className="flex items-center gap-2">✓ Integrations</li>
              </ul>
              <a
                href="https://buy.stripe.com/7sYcN7fKPg23cRo8D157W0q"
                className="mt-6 block w-full rounded-lg bg-gray-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
              >
                Subscribe — ${prices.shop}/mo
              </a>
            </div>
          </div>
          {annual && (
            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Annual plans are billed at ${prices.starter * 12}, ${prices.pro * 12}, and ${prices.shop * 12} per year respectively.
            </p>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-t border-gray-200 bg-white px-6 py-20 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">How it works</h2>
          <p className="mt-4 text-center text-gray-600 dark:text-gray-400">
            From estimate to signed proposal in three steps.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              { step: "1", title: "Create Estimate", desc: "Pick a template, adjust line items, and build an accurate estimate in minutes — not hours." },
              { step: "2", title: "Generate Proposal", desc: "One click turns your estimate into a branded, professional PDF with pricing, terms, and signature capture." },
              { step: "3", title: "Track & Win", desc: "Follow every estimate through won or lost. Track actual costs to sharpen pricing and win more profitable work." },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950">
                  <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{item.step}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trades We Serve */}
      <section id="trades" className="border-t border-gray-200 bg-gray-50 px-6 py-20 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">Built for every trade</h2>
          <p className="mt-4 text-center text-gray-600 dark:text-gray-400">
            Pre-built templates for the trades that build America.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { name: "Electrical", emoji: "⚡", slug: "electrical-estimating", count: 4, desc: "Panel upgrades, EV chargers, rewires, lighting" },
              { name: "HVAC", emoji: "🔥", slug: "hvac-estimating", count: 4, desc: "Furnaces, AC units, heat pumps, ductwork" },
              { name: "Plumbing", emoji: "🔧", slug: "plumbing-estimating", count: 4, desc: "Water heaters, sewer lines, gas lines" },
              { name: "Roofing", emoji: "🏠", slug: "roofing-estimating", count: 4, desc: "Shingle, metal, flat roofs, gutters" },
              { name: "General", emoji: "🏗️", slug: "general-contracting", count: 6, desc: "Remodels, decks, basements, windows" },
            ].map((trade) => (
              <Link
                key={trade.slug}
                to={`/trade/${trade.slug}`}
                className="group rounded-xl border border-gray-200 bg-white p-6 text-center transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <span className="text-3xl">{trade.emoji}</span>
                <h3 className="mt-3 font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{trade.name}</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{trade.count} templates</p>
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{trade.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-gray-200 bg-indigo-600 px-6 py-16 dark:bg-indigo-950">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-8 text-center sm:grid-cols-4">
            {[
              { value: "22", label: "Pre-built Templates" },
              { value: "5", label: "Trades Supported" },
              { value: "107", label: "Line Items Ready" },
              { value: "14-Day", label: "Free Trial" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-4xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-sm text-indigo-200">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-gray-200 bg-white px-6 py-20 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold">Frequently asked questions</h2>
          <div className="mt-12 space-y-4">
            {[
              { q: "Is there a free trial?", a: "Yes! You get a full 14-day free trial with no credit card required. Explore all features, build estimates, and decide if BuildBid fits your workflow." },
              { q: "Can I customize line items?", a: "Absolutely. Every template is fully customizable. Add, remove, or adjust line items, quantities, unit costs, and markup percentages to match your exact pricing." },
              { q: "Does it work with QuickBooks?", a: "BuildBid Shop plan includes QuickBooks integration for seamless export of estimates and invoices. Starter and Pro plans support manual CSV export." },
              { q: "What trades do you support?", a: "We support electrical, HVAC, plumbing, roofing, and general contracting right out of the box. Each trade has pre-built templates with realistic line items and pricing." },
              { q: "Can my whole team use it?", a: "Yes! The Pro plan supports up to 5 users, and the Shop plan supports unlimited users — perfect for growing contracting businesses with multiple estimators." },
              { q: "Can I send proposals to customers?", a: "Yes — turn any estimate into a branded PDF proposal with signature capture in one click. Customers can review and sign digitally." },
            ].map((faq, i) => (
              <details key={i} className="group rounded-xl border border-gray-200 dark:border-gray-800" open={i === 0}>
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-left font-medium text-gray-900 dark:text-gray-100">
                  {faq.q}
                  <svg className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                </summary>
                <p className="px-6 pb-4 text-sm text-gray-600 dark:text-gray-400">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-gray-200 bg-gray-50 px-6 py-20 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold">Ready to win more profitable work?</h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Join hundreds of trade contractors who've swapped spreadsheets for BuildBid.
          </p>
          <div className="mt-8">
            <Link
              to="/signup"
              className="rounded-lg bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Start Your Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 py-12 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 sm:grid-cols-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Product</h4>
              <ul className="mt-3 space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><Link to="/templates" className="hover:text-indigo-600 dark:hover:text-indigo-400">Templates</Link></li>
                <li><Link to="/estimates" className="hover:text-indigo-600 dark:hover:text-indigo-400">Estimates</Link></li>
                <li><Link to="/dashboard" className="hover:text-indigo-600 dark:hover:text-indigo-400">Dashboard</Link></li>
                <li><a href="#pricing" className="hover:text-indigo-600 dark:hover:text-indigo-400">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Trades</h4>
              <ul className="mt-3 space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><Link to="/trade/electrical-estimating" className="hover:text-indigo-600 dark:hover:text-indigo-400">Electrical</Link></li>
                <li><Link to="/trade/hvac-estimating" className="hover:text-indigo-600 dark:hover:text-indigo-400">HVAC</Link></li>
                <li><Link to="/trade/plumbing-estimating" className="hover:text-indigo-600 dark:hover:text-indigo-400">Plumbing</Link></li>
                <li><Link to="/trade/roofing-estimating" className="hover:text-indigo-600 dark:hover:text-indigo-400">Roofing</Link></li>
                <li><Link to="/trade/general-contracting" className="hover:text-indigo-600 dark:hover:text-indigo-400">General</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Resources</h4>
              <ul className="mt-3 space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><Link to="/blog" className="hover:text-indigo-600 dark:hover:text-indigo-400">Blog</Link></li>
                <li><Link to="/download-free-estimating-template" className="hover:text-indigo-600 dark:hover:text-indigo-400">Free Estimating Template</Link></li>
                <li><a href="#faq" className="hover:text-indigo-600 dark:hover:text-indigo-400">FAQ</a></li>
                <li><a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400">Features</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">BuildBid</h4>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                Estimating software built for trade contractors. Win more profitable work with less overhead.
              </p>
              <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                &copy; {new Date().getFullYear()} BuildBid. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
