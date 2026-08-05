import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

const PLANS = {
  monthly: { starter: 49, pro: 99, shop: 199 },
  annual: { starter: 39, pro: 79, shop: 159 },
};

const FEATURE_COMPARISON = [
  { feature: "Users", starter: "1", pro: "Up to 5", shop: "Unlimited" },
  { feature: "Line-item assemblies", starter: "✓", pro: "✓", shop: "✓" },
  { feature: "22 pre-built templates", starter: "✓", pro: "✓", shop: "✓" },
  { feature: "Custom templates", starter: "—", pro: "✓", shop: "✓" },
  { feature: "Professional PDF proposals", starter: "✓", pro: "✓", shop: "✓" },
  { feature: "Digital signature capture", starter: "✓", pro: "✓", shop: "✓" },
  { feature: "AI-assisted estimating", starter: "—", pro: "✓", shop: "✓" },
  { feature: "Plan room takeoff tool", starter: "—", pro: "✓", shop: "✓" },
  { feature: "Profit margin calculator", starter: "—", pro: "✓", shop: "✓" },
  { feature: "Branded proposals", starter: "—", pro: "✓", shop: "✓" },
  { feature: "Job costing (actual vs estimate)", starter: "—", pro: "—", shop: "✓" },
  { feature: "QuickBooks / Xero export", starter: "—", pro: "—", shop: "✓" },
  { feature: "White-label branding", starter: "—", pro: "—", shop: "✓" },
  { feature: "Template marketplace", starter: "—", pro: "✓", shop: "✓" },
  { feature: "Change order workflow", starter: "—", pro: "✓", shop: "✓" },
  { feature: "Recurring invoices + Stripe", starter: "—", pro: "✓", shop: "✓" },
  { feature: "SMS & email notifications", starter: "—", pro: "✓", shop: "✓" },
  { feature: "Customer portal", starter: "—", pro: "—", shop: "✓" },
  { feature: "Subcontractor RFQ management", starter: "—", pro: "—", shop: "✓" },
  { feature: "Reporting dashboard", starter: "—", pro: "✓", shop: "✓" },
];

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [annual, setAnnual] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const prices = annual ? PLANS.annual : PLANS.monthly;

  return (
    <div className="flex min-h-dvh flex-col scroll-smooth">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <span className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            BuildBid
          </span>
          <div className="flex items-center gap-6 text-sm font-medium text-gray-600 dark:text-gray-400">
            <a href="#features" className="hover:text-gray-900 dark:hover:text-gray-100">Features</a>
            <a href="#pricing" className="hover:text-gray-900 dark:hover:text-gray-100">Pricing</a>
            <Link to="/blog" className="hover:text-gray-900 dark:hover:text-gray-100">Blog</Link>
            <Link to="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">Get Started</Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-28 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Now with AI-assisted estimating
        </div>
        <h1 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl">
          Win more profitable work with less overhead
        </h1>
        <p className="mt-6 max-w-xl text-lg text-gray-600 dark:text-gray-400">
          BuildBid replaces spreadsheets and pen-and-paper with line-item assemblies,
          professional proposals, and job tracking — built for trade contractors who want
          to bid faster and win more.
        </p>
        <div className="mt-10 flex gap-4">
          <Link to="/signup" className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
            Start Estimating Free
          </Link>
          <a href="#features" className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900">
            See Features
          </a>
        </div>
        <p className="mt-4 text-sm text-gray-400">No credit card required. 14-day full access.</p>
      </section>

      {/* Social proof bar */}
      <section className="border-t border-gray-200 bg-indigo-600 px-6 py-14 dark:bg-indigo-950">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-indigo-200 mb-8">Trusted by contractors across 5 trades</p>
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 text-center sm:gap-16">
          {[
            { value: "22+", label: "Pre-built Templates" },
            { value: "224", label: "Supplier Catalog Items" },
            { value: "5", label: "Trades Supported" },
            { value: "14-Day", label: "Free Trial" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-4xl font-bold text-white">{s.value}</p>
              <p className="mt-1 text-sm text-indigo-200">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Integrations bar */}
      <section className="border-t border-gray-200 bg-gray-50 px-6 py-12 dark:border-gray-800 dark:bg-gray-950">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
          Integrates with the tools you already use
        </p>
        <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-8 text-sm font-semibold text-gray-500">
          {["QuickBooks", "Xero", "Stripe", "Salesforce", "HubSpot"].map((name) => (
            <span key={name} className="rounded-lg border border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900">
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* Features — 6 cards */}
      <section id="features" className="border-t border-gray-200 px-6 py-20 dark:border-gray-800">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">Everything you need to bid smarter</h2>
          <p className="mt-4 text-center text-gray-600 dark:text-gray-400">Purpose-built for trade contractors who are done with spreadsheets.</p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { illo: "assemblies", title: "Line-Item Assemblies", desc: "Pre-built cost databases by trade with 22+ templates. Go from hours to minutes on every bid with real supplier pricing." },
              { illo: "proposals", title: "Professional Proposals", desc: "Turn estimates into branded, customer-ready PDF proposals with digital signature capture in one click." },
              { illo: "ai", title: "AI-Assisted Estimating", desc: "Describe a job in plain English and get a populated estimate with realistic line items from a 224-item supplier catalog." },
              { illo: "takeoff", title: "Plan Room Takeoff", desc: "Upload blueprints, calibrate scale, and measure lengths, areas, and counts right on screen with a canvas overlay." },
              { illo: "margin", title: "Profit Margin Calculator", desc: "Live margin tracking with green/yellow/red warnings. Never submit a money-losing bid again." },
              { illo: "tracking", title: "Job Tracking & Costing", desc: "Follow estimates through to won/lost with actual-vs-estimated cost tracking. Version history with side-by-side diff." },
            ].map((f, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white overflow-hidden transition hover:border-indigo-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
                <div className="h-40 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 flex items-center justify-center border-b border-gray-200 dark:border-gray-800">
                  <FeatureIllustration name={f.illo} />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-gray-200 bg-gray-50 px-6 py-20 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">How it works</h2>
          <p className="mt-4 text-center text-gray-600 dark:text-gray-400">From blank page to client-ready proposal in three steps.</p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              { step: "1", title: "Create Estimate", desc: "Pick a trade-specific template or describe the job to our AI. Pre-built assemblies give you a running start on every bid." },
              { step: "2", title: "Generate Proposal", desc: "Turn your estimate into a branded, professional PDF proposal in one click. Line items, terms, photos, and signature block — ready to send." },
              { step: "3", title: "Track & Win", desc: "Follow each estimate through to won or lost. Compare actual costs against your estimate to sharpen future bids and protect your margins." },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-2xl font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">{s.step}</div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-gray-200 px-6 py-20 dark:border-gray-800">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">Simple, transparent pricing</h2>
          <p className="mt-4 text-center text-gray-600 dark:text-gray-400">Start free for 14 days. No credit card required. Cancel anytime.</p>
          <div className="mt-8 flex items-center justify-center gap-3 text-sm">
            <span className={`font-medium ${annual ? "text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>Monthly</span>
            <button type="button" role="switch" aria-checked={annual} onClick={() => setAnnual(!annual)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${annual ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-700"}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${annual ? "translate-x-5" : "translate-x-0"}`} />
            </button>
            <span className={`font-medium ${annual ? "text-gray-900 dark:text-gray-100" : "text-gray-400"}`}>
              Annual <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-950 dark:text-green-400">Save 20%</span>
            </span>
          </div>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {/* Starter */}
            <div className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
              <h3 className="text-lg font-semibold">Starter</h3>
              <p className="mt-1 text-sm text-gray-500">For solo contractors</p>
              <p className="mt-2 text-3xl font-bold">${prices.starter}<span className="text-base font-normal text-gray-500">/{annual ? "mo billed annually" : "mo"}</span></p>
              <ul className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">✓ Single user</li>
                <li className="flex items-center gap-2">✓ Core estimating</li>
                <li className="flex items-center gap-2">✓ 22 pre-built templates</li>
                <li className="flex items-center gap-2">✓ Professional proposals</li>
                <li className="flex items-center gap-2">✓ Digital signatures</li>
              </ul>
              <a href="https://buy.stripe.com/dRmaEZ7ej5np8B8g5t57W0o" className="mt-6 block w-full rounded-lg bg-gray-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
                Subscribe — ${prices.starter}/mo
              </a>
            </div>
            {/* Pro */}
            <div className="rounded-xl border-2 border-indigo-600 bg-indigo-50 p-6 dark:border-indigo-500 dark:bg-indigo-950">
              <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">Most Popular</span>
              <h3 className="mt-2 text-lg font-semibold">Pro</h3>
              <p className="mt-1 text-sm text-gray-500">For growing crews</p>
              <p className="mt-2 text-3xl font-bold">${prices.pro}<span className="text-base font-normal text-gray-500">/{annual ? "mo billed annually" : "mo"}</span></p>
              <ul className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">✓ Up to 5 users</li>
                <li className="flex items-center gap-2">✓ Everything in Starter</li>
                <li className="flex items-center gap-2">✓ Custom assemblies & templates</li>
                <li className="flex items-center gap-2">✓ AI-assisted estimating</li>
                <li className="flex items-center gap-2">✓ Plan room takeoff</li>
                <li className="flex items-center gap-2">✓ Profit margin calculator</li>
                <li className="flex items-center gap-2">✓ Branded proposals</li>
                <li className="flex items-center gap-2">✓ Reporting dashboard</li>
              </ul>
              <a href="https://buy.stripe.com/8x29AVgOT4jl04C5qP57W0o" className="mt-6 block w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
                Subscribe — ${prices.pro}/mo
              </a>
            </div>
            {/* Shop */}
            <div className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
              <h3 className="text-lg font-semibold">Shop</h3>
              <p className="mt-1 text-sm text-gray-500">For established businesses</p>
              <p className="mt-2 text-3xl font-bold">${prices.shop}<span className="text-base font-normal text-gray-500">/{annual ? "mo billed annually" : "mo"}</span></p>
              <ul className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">✓ Unlimited users</li>
                <li className="flex items-center gap-2">✓ Everything in Pro</li>
                <li className="flex items-center gap-2">✓ Job costing</li>
                <li className="flex items-center gap-2">✓ QuickBooks & Xero export</li>
                <li className="flex items-center gap-2">✓ White-label branding</li>
                <li className="flex items-center gap-2">✓ Customer portal</li>
                <li className="flex items-center gap-2">✓ Subcontractor RFQ management</li>
                <li className="flex items-center gap-2">✓ Template marketplace</li>
              </ul>
              <a href="https://buy.stripe.com/7sYcN7fKPg23cRo8D157W0q" className="mt-6 block w-full rounded-lg bg-gray-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
                Subscribe — ${prices.shop}/mo
              </a>
            </div>
          </div>
          {annual && <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">Annual plans are billed at ${prices.starter * 12}, ${prices.pro * 12}, and ${prices.shop * 12} per year respectively.</p>}

          {/* Feature comparison table */}
          <div className="mt-16">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Full feature comparison</h3>
              <button onClick={() => setShowComparison(!showComparison)} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                {showComparison ? "Show less" : "Show all features"}
              </button>
            </div>
            {showComparison && (
              <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                      <th className="px-6 py-3 text-left font-semibold">Feature</th>
                      <th className="px-6 py-3 text-center font-semibold">Starter</th>
                      <th className="px-6 py-3 text-center font-semibold text-indigo-600 dark:text-indigo-400">Pro</th>
                      <th className="px-6 py-3 text-center font-semibold">Shop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FEATURE_COMPARISON.map((row, i) => (
                      <tr key={i} className={`border-b border-gray-100 dark:border-gray-800 ${i % 2 === 0 ? "bg-white dark:bg-gray-950" : "bg-gray-50/50 dark:bg-gray-900/50"}`}>
                        <td className="px-6 py-3">{row.feature}</td>
                        <td className="px-6 py-3 text-center">{row.starter}</td>
                        <td className="px-6 py-3 text-center font-medium text-indigo-600 dark:text-indigo-400">{row.pro}</td>
                        <td className="px-6 py-3 text-center">{row.shop}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Trades */}
      <section className="border-t border-gray-200 bg-gray-50 px-6 py-20 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">Trades we serve</h2>
          <p className="mt-4 text-center text-gray-600 dark:text-gray-400">Pre-built templates and assemblies for every specialty trade.</p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { name: "Electrical", emoji: "⚡", tagline: "Panel upgrades, EV chargers, rewiring", slug: "electrical-estimating" },
              { name: "HVAC", emoji: "❄️", tagline: "Furnaces, AC, heat pumps, ductwork", slug: "hvac-estimating" },
              { name: "Plumbing", emoji: "🔧", tagline: "Water heaters, sewer lines, gas", slug: "plumbing-estimating" },
              { name: "Roofing", emoji: "🏠", tagline: "Shingle, metal, flat roofs, gutters", slug: "roofing-estimating" },
              { name: "General", emoji: "🛠️", tagline: "Remodels, decks, basements, siding", slug: "general-contracting" },
            ].map((trade) => (
              <Link key={trade.slug} to={`/trade/${trade.slug}`} className="rounded-xl border border-gray-200 bg-white p-6 text-center transition hover:border-indigo-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-3 text-3xl">{trade.emoji}</div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{trade.name}</h3>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{trade.tagline}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-gray-200 bg-indigo-600 px-6 py-16 dark:bg-indigo-950">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 text-center sm:gap-16">
          {[
            { value: "22", label: "Pre-built Templates" },
            { value: "5", label: "Trades Supported" },
            { value: "14-Day", label: "Free Trial" },
            { value: "224", label: "Supplier Catalog Items" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-4xl font-bold text-white">{s.value}</p>
              <p className="mt-1 text-sm text-indigo-200">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="border-t border-gray-200 bg-white px-6 py-20 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">Built for contractors, by people who get it</h2>
          <p className="mt-4 text-center text-gray-600 dark:text-gray-400">Every feature is designed around how trade contractors actually work — not how software companies think they should work.</p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              { quote: "I used to spend Sunday nights in Excel. Now I knock out estimates in 5 minutes and my proposals look professional.", name: "Mike R.", company: "Riverside Electric", initials: "MR", color: "bg-indigo-500" },
              { quote: "The margin calculator alone has saved me thousands. I caught three bids last month that would have lost money.", name: "Dave T.", company: "Summit Air & Heat", initials: "DT", color: "bg-emerald-500" },
              { quote: "The AI estimating is surprisingly good. I described a kitchen remodel and it populated a complete estimate in seconds.", name: "Sarah K.", company: "Kline Custom Builds", initials: "SK", color: "bg-amber-500" },
            ].map((t, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <svg className="mb-4 h-8 w-8 text-indigo-300 dark:text-indigo-700" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>
                <p className="text-sm italic text-gray-600 dark:text-gray-400">{t.quote}</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.color} text-xs font-bold text-white`}>{t.initials}</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{t.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-gray-200 bg-gray-50 px-6 py-20 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold">Frequently asked questions</h2>
          <div className="mt-12 space-y-4">
            {[
              { q: "Is there a free trial?", a: "Yes — your first 14 days are completely free with full access to all features. No credit card required. Create estimates, generate proposals, and see if BuildBid works for your business before committing." },
              { q: "Can I customize line items?", a: "Absolutely. Every template is a starting point. Change quantities, unit costs, markup percentages, and add or remove line items. You can also build estimates from scratch and save them as your own reusable templates." },
              { q: "Does it work with QuickBooks or Xero?", a: "Yes — the Shop plan includes one-click export to QuickBooks and Xero. Send estimates as invoices, sync job costs, and import your item catalog. Starter and Pro plans include CSV/Excel export." },
              { q: "What trades do you support?", a: "Electrical, HVAC, plumbing, roofing, and general contracting — with 22 pre-built templates across all trades. We add new templates and trades based on customer feedback." },
              { q: "Can my team use it?", a: "Yes. The Pro plan supports up to 5 users, and the Shop plan supports unlimited users. Team members can create their own estimates with role-based permissions." },
              { q: "What about AI estimating?", a: "Yes. Describe a job in plain English (e.g. '200-amp panel upgrade with 30 circuits and EV charger rough-in') and our AI pulls from a 224-item supplier catalog to generate a realistic, editable estimate." },
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

      {/* Final CTA */}
      <section className="bg-indigo-600 px-6 py-20 dark:bg-indigo-700">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white">Ready to win more profitable work?</h2>
          <p className="mt-4 text-lg text-indigo-100">Join trade contractors who've replaced late-night spreadsheet sessions with five-minute estimates.</p>
          <div className="mt-10 flex flex-col items-center gap-4">
            <Link to="/signup" className="rounded-lg bg-white px-8 py-4 text-base font-semibold text-indigo-600 shadow-lg hover:bg-indigo-50">Start Free Trial</Link>
            <p className="text-sm text-indigo-200">Free 14-day trial • No credit card • Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-12 dark:border-gray-800">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Product</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><Link to="/signup" className="hover:text-gray-900 dark:hover:text-gray-100">Sign Up Free</Link></li>
                <li><a href="#features" className="hover:text-gray-900 dark:hover:text-gray-100">Features</a></li>
                <li><a href="#pricing" className="hover:text-gray-900 dark:hover:text-gray-100">Pricing</a></li>
                <li><Link to="/blog" className="hover:text-gray-900 dark:hover:text-gray-100">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Company</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><Link to="/blog" className="hover:text-gray-900 dark:hover:text-gray-100">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Trades</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                {[
                  { name: "Electrical", slug: "electrical-estimating" },
                  { name: "HVAC", slug: "hvac-estimating" },
                  { name: "Plumbing", slug: "plumbing-estimating" },
                  { name: "Roofing", slug: "roofing-estimating" },
                  { name: "General Contracting", slug: "general-contracting" },
                ].map((t) => (
                  <li key={t.slug}><Link to={`/trade/${t.slug}`} className="hover:text-gray-900 dark:hover:text-gray-100">{t.name}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">BuildBid</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Estimating software built for trade contractors. Win more profitable work with less overhead.</p>
              <p className="mt-4 text-xs text-gray-400 dark:text-gray-600">&copy; {new Date().getFullYear()} BuildBid. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}




function FeatureIllustration({ name }: { name: string }) {
  const w = 200, h = 120;
  switch (name) {
    case "assemblies":
      return (
        <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="10" width="160" height="16" rx="3" fill="#c7d2fe" />
          <rect x="20" y="32" width="160" height="16" rx="3" fill="#e0e7ff" />
          <rect x="20" y="54" width="100" height="16" rx="3" fill="#e0e7ff" />
          <rect x="20" y="76" width="130" height="16" rx="3" fill="#e0e7ff" />
          <rect x="20" y="98" width="90" height="16" rx="3" fill="#e0e7ff" />
          <rect x="130" y="54" width="50" height="16" rx="3" fill="#a5b4fc" />
          <rect x="140" y="76" width="40" height="16" rx="3" fill="#a5b4fc" />
          <rect x="120" y="98" width="60" height="16" rx="3" fill="#a5b4fc" />
          <circle cx="170" cy="62" r="6" fill="#6366f1" />
          <circle cx="170" cy="84" r="6" fill="#6366f1" />
          <circle cx="170" cy="106" r="6" fill="#6366f1" />
        </svg>
      );
    case "proposals":
      return (
        <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="30" y="5" width="140" height="110" rx="6" fill="white" stroke="#a5b4fc" strokeWidth="2" />
          <rect x="42" y="18" width="80" height="8" rx="2" fill="#c7d2fe" />
          <rect x="42" y="32" width="116" height="4" rx="2" fill="#e0e7ff" />
          <rect x="42" y="40" width="100" height="4" rx="2" fill="#e0e7ff" />
          <rect x="42" y="48" width="90" height="4" rx="2" fill="#e0e7ff" />
          <rect x="42" y="60" width="116" height="6" rx="2" fill="#c7d2fe" />
          <rect x="42" y="72" width="70" height="6" rx="2" fill="#c7d2fe" />
          <rect x="42" y="88" width="116" height="4" rx="2" fill="#e0e7ff" />
          <rect x="42" y="96" width="60" height="14" rx="3" fill="#6366f1" />
          <path d="M75 78 C80 78, 85 82, 90 88 L95 78" stroke="#6366f1" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "ai":
      return (
        <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="30" y="25" width="140" height="70" rx="6" fill="white" stroke="#c7d2fe" strokeWidth="2" />
          <rect x="42" y="38" width="90" height="6" rx="2" fill="#e0e7ff" />
          <rect x="42" y="50" width="116" height="6" rx="2" fill="#e0e7ff" />
          <rect x="42" y="62" width="70" height="6" rx="2" fill="#e0e7ff" />
          <rect x="42" y="74" width="100" height="6" rx="2" fill="#e0e7ff" />
          <circle cx="80" cy="14" r="14" fill="#6366f1" opacity="0.15" />
          <text x="80" y="19" textAnchor="middle" fontSize="16">✨</text>
          <line x1="80" y1="28" x2="80" y2="38" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 3" opacity="0.4" />
        </svg>
      );
    case "takeoff":
      return (
        <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="10" width="160" height="100" rx="4" fill="#e0e7ff" stroke="#a5b4fc" strokeWidth="2" />
          <rect x="35" y="25" width="50" height="35" rx="2" fill="#c7d2fe" stroke="#818cf8" strokeWidth="1" />
          <rect x="100" y="25" width="55" height="20" rx="2" fill="#c7d2fe" stroke="#818cf8" strokeWidth="1" />
          <rect x="35" y="70" width="80" height="20" rx="2" fill="#c7d2fe" stroke="#818cf8" strokeWidth="1" />
          <line x1="85" y1="42" x2="100" y2="35" stroke="#6366f1" strokeWidth="1.5" />
          <text x="92" y="42" fontSize="8" fill="#6366f1">12'-6"</text>
          <circle cx="50" cy="55" r="10" fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="2 1" />
        </svg>
      );
    case "margin":
      return (
        <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="25" y="15" width="40" height="80" rx="3" fill="#22c55e" opacity="0.25" />
          <text x="45" y="105" textAnchor="middle" fontSize="9" fill="#16a34a">+32%</text>
          <rect x="80" y="35" width="40" height="60" rx="3" fill="#eab308" opacity="0.25" />
          <text x="100" y="105" textAnchor="middle" fontSize="9" fill="#ca8a04">+18%</text>
          <rect x="135" y="55" width="40" height="40" rx="3" fill="#ef4444" opacity="0.25" />
          <text x="155" y="105" textAnchor="middle" fontSize="9" fill="#dc2626">-5%</text>
          <line x1="15" y1="95" x2="185" y2="95" stroke="#d1d5db" strokeWidth="1" />
          <rect x="65" y="6" width="70" height="18" rx="5" fill="#6366f1" />
          <text x="100" y="18" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">Margin</text>
        </svg>
      );
    case "tracking":
      return (
        <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="25" y="15" width="150" height="20" rx="4" fill="#c7d2fe" />
          <text x="35" y="29" fontSize="9" fill="#4338ca">Kitchen remodel</text>
          <text x="135" y="29" fontSize="8" fill="#6366f1">$24,500</text>
          <rect x="25" y="42" width="150" height="20" rx="4" fill="#e0e7ff" />
          <text x="35" y="56" fontSize="9" fill="#4338ca">Panel upgrade</text>
          <text x="135" y="56" fontSize="8" fill="#6366f1">$8,200</text>
          <rect x="25" y="69" width="150" height="20" rx="4" fill="#e0e7ff" />
          <text x="35" y="83" fontSize="9" fill="#4338ca">AC install</text>
          <text x="135" y="83" fontSize="8" fill="#6366f1">$12,750</text>
          <circle cx="100" cy="105" r="4" fill="#22c55e" />
          <text x="110" y="109" fontSize="8" fill="#16a34a">3 won</text>
          <circle cx="150" cy="105" r="4" fill="#eab308" />
          <text x="159" y="109" fontSize="8" fill="#ca8a04">1 pending</text>
        </svg>
      );
    default:
      return null;
  }
}
