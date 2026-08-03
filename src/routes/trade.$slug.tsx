import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";

interface TradeInfo {
  slug: string;
  tradeType: string;
  title: string;
  subtitle: string;
  description: string;
  valueProps: { icon: string; title: string; desc: string }[];
  ctaTitle: string;
  ctaBody: string;
}

const TRADE_INFO: Record<string, TradeInfo> = {
  "electrical-estimating": {
    slug: "electrical-estimating",
    tradeType: "electrical",
    title: "Electrical Estimating Software",
    subtitle: "Built for electrical contractors who need accurate bids, fast.",
    description: "Stop building panel upgrades from scratch. BuildBid gives you pre-built templates for panel upgrades, EV charger installs, service rewires, and lighting retrofits — so you can estimate in minutes instead of hours.",
    valueProps: [
      { icon: "⚡", title: "Pre-built electrical assemblies", desc: "200A panel upgrades, EV chargers, whole-house rewires, and LED retrofits — all pre-loaded with real prices." },
      { icon: "📋", title: "Professional proposals in one click", desc: "Your estimate becomes a branded PDF with line items, terms, and signature capture. No formatting required." },
      { icon: "📊", title: "Win/loss tracking by trade", desc: "Know exactly which electrical jobs you're winning and at what margins. Adjust pricing based on real data." },
    ],
    ctaTitle: "Win more electrical work with less estimating overhead",
    ctaBody: "Start your free trial and run your first electrical estimate in under 30 minutes. 22 templates across 5 trades, 4 built specifically for electrical contractors.",
  },
  "hvac-estimating": {
    slug: "hvac-estimating",
    tradeType: "hvac",
    title: "HVAC Estimating Software",
    subtitle: "Accurate HVAC bids with pre-built templates for furnace, AC, heat pump, and ductwork jobs.",
    description: "Stop pricing jobs from memory. BuildBid gives you pre-built templates for furnace replacements, central AC installs, heat pump conversions, and ductwork replacements — with real equipment pricing and labor estimates.",
    valueProps: [
      { icon: "❄️", title: "Pre-built HVAC assemblies", desc: "Furnace replacements, 16+ SEER AC installs, heat pump conversions, and full ductwork replacements — ready to customize." },
      { icon: "📄", title: "Branded, professional proposals", desc: "One click turns your estimate into a customer-ready PDF with equipment specs, line items, and a signature block." },
      { icon: "📈", title: "Track actual vs. estimated costs", desc: "Compare your estimated labor hours and material costs against actuals. Get better at pricing with every job." },
    ],
    ctaTitle: "Close more HVAC bids with professional estimating",
    ctaBody: "Stop guessing and start winning. 4 HVAC templates pre-loaded with realistic equipment and labor pricing.",
  },
  "plumbing-estimating": {
    slug: "plumbing-estimating",
    tradeType: "plumbing",
    title: "Plumbing Estimating Software",
    subtitle: "From water heaters to sewer lines — estimate plumbing jobs accurately and fast.",
    description: "Plumbing estimates have a lot of moving parts. BuildBid's pre-built templates for water heaters, tankless installs, sewer line replacements, and gas line runs make sure you never miss a fitting, permit, or labor hour.",
    valueProps: [
      { icon: "🔧", title: "Pre-built plumbing assemblies", desc: "Tankless water heaters, sewer line replacements, gas line installs, and 50-gallon tank replacements — priced and ready." },
      { icon: "✍️", title: "Digital signature capture", desc: "Send professional proposals that customers can sign on their phone. No printing, no scanning." },
      { icon: "📅", title: "Job scheduling built in", desc: "Schedule won jobs on a calendar, track pipeline status, and never double-book a crew." },
    ],
    ctaTitle: "Stop losing money on underpriced plumbing jobs",
    ctaBody: "4 plumbing templates with realistic material and labor pricing. Start your free trial — no credit card needed.",
  },
  "roofing-estimating": {
    slug: "roofing-estimating",
    tradeType: "roofing",
    title: "Roofing Estimating Software",
    subtitle: "Accurate roofing estimates for shingle, metal, TPO, and gutter jobs.",
    description: "Roofing estimates are all about square footage, materials, and labor. BuildBid's templates for asphalt shingle, standing seam metal, flat TPO, and gutter replacements handle the math so you can focus on closing the deal.",
    valueProps: [
      { icon: "🏠", title: "Pre-built roofing assemblies", desc: "Architectural shingles, standing seam metal, flat TPO membrane, and seamless gutter replacements — all templated." },
      { icon: "🧮", title: "Automatic square footage math", desc: "Enter the squares and the template calculates materials, fasteners, underlayment, and labor." },
      { icon: "📧", title: "Email proposals directly", desc: "Send professional, branded PDFs straight to the customer's inbox. Track when they open it." },
    ],
    ctaTitle: "Win more roofing bids with accurate, professional estimates",
    ctaBody: "4 roofing templates covering the most common roofing jobs. Start estimating in under 30 minutes.",
  },
  "general-contracting": {
    slug: "general-contracting",
    tradeType: "general",
    title: "General Contractor Estimating Software",
    subtitle: "Estimate remodels, decks, basements, windows, and siding with pre-built templates.",
    description: "General contractors juggle more trade types than anyone. BuildBid's templates for kitchen remodels, deck builds, basement finishes, window replacements, and siding jobs give you a running start on every estimate — no matter the project.",
    valueProps: [
      { icon: "🏗️", title: "Pre-built GC assemblies", desc: "Kitchen remodels, composite decks, basement finishes, window replacements, and vinyl siding — with real pricing." },
      { icon: "🔄", title: "Change order management", desc: "Handle change orders professionally — send, get approval, and track revisions without the paperwork headache." },
      { icon: "💰", title: "Job costing & profitability", desc: "Track actual vs. estimated costs on every job. Know your true margins and where to improve." },
    ],
    ctaTitle: "Estimate every type of job with confidence",
    ctaBody: "6 general contracting templates plus 16 more across 4 specialty trades. The most comprehensive template library for trade contractors.",
  },
};

export const Route = createFileRoute("/trade/$slug")({
  loader: async () => ({}),
  component: TradeLanding,
  head: ({ params }) => {
    const info = TRADE_INFO[params.slug as string];
    return {
      meta: [
        { title: info ? `${info.title} — BuildBid` : "Trade Estimating Software — BuildBid" },
        { name: "description", content: info?.subtitle || "Professional estimating software for trade contractors." },
      ],
    };
  },
});

function TradeLanding() {
  const { slug } = Route.useParams();
  const info = TRADE_INFO[slug as string];
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!info) { setLoading(false); return; }
    fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "templates.getTemplates", args: { data: { trade: info.tradeType } } }),
    })
    .then(r => r.json())
    .then(d => { if (d?.templates) setTemplates(d.templates); })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, [slug]);

  if (!info) {
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
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-32 text-center">
          <h1 className="text-3xl font-bold">Trade Not Found</h1>
          <p className="mt-4 text-gray-600 dark:text-gray-400">The estimating page you're looking for doesn't exist. Check out our trade-specific pages below.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {Object.keys(TRADE_INFO).map(s => (
              <Link key={s} to="/trade/$slug" params={{ slug: s }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">{TRADE_INFO[s].tradeType.charAt(0).toUpperCase() + TRADE_INFO[s].tradeType.slice(1)}</Link>
            ))}
          </div>
        </main>
      </div>
    );
  }

  const tradeColorMap: Record<string, string> = {
    electrical: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
    plumbing: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    hvac: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    roofing: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    general: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Home</Link>
            <Link to="/blog" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Blog</Link>
            <Link to="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Start Free Trial</Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16">
        {/* Hero */}
        <div className="text-center">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium capitalize ${tradeColorMap[info.tradeType] || "bg-gray-100"}`}>{info.tradeType}</span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{info.title}</h1>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">{info.subtitle}</p>
          <p className="mt-6 mx-auto max-w-2xl text-gray-600 dark:text-gray-400 leading-relaxed">{info.description}</p>
          <Link to="/signup" className="mt-8 inline-block rounded-lg bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-700">
            Start Free 14-Day Trial
          </Link>
          <p className="mt-2 text-sm text-gray-400">No credit card required</p>
        </div>

        {/* Value Props */}
        <div className="mt-20 grid gap-8 sm:grid-cols-3">
          {info.valueProps.map((vp, i) => (
            <div key={i} className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
              <span className="text-3xl">{vp.icon}</span>
              <h3 className="mt-3 text-lg font-semibold">{vp.title}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{vp.desc}</p>
            </div>
          ))}
        </div>

        {/* Templates */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-center">Pre-built {info.tradeType.charAt(0).toUpperCase() + info.tradeType.slice(1)} Templates</h2>
          <p className="mt-2 text-center text-gray-600 dark:text-gray-400">Start from these templates and customize for your project.</p>
          {loading ? (
            <div className="mt-8 text-center text-gray-500">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="mt-8 text-center text-gray-500">No templates found for this trade yet.</div>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {templates.map((tpl: any) => (
                <div key={tpl.id} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tradeColorMap[tpl.trade_type] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"}`}>{tpl.trade_type}</span>
                  <h3 className="mt-2 text-base font-semibold">{tpl.name}</h3>
                  {tpl.description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{tpl.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trade-specific pages links */}
        <div className="mt-20">
          <h2 className="text-xl font-bold text-center">Explore Other Trades</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {Object.keys(TRADE_INFO).filter(s => s !== slug).map(s => (
              <Link key={s} to="/trade/$slug" params={{ slug: s }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                {TRADE_INFO[s].tradeType.charAt(0).toUpperCase() + TRADE_INFO[s].tradeType.slice(1)} Estimating
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 rounded-2xl bg-indigo-600 px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-white">{info.ctaTitle}</h2>
          <p className="mt-4 mx-auto max-w-xl text-lg text-indigo-100">{info.ctaBody}</p>
          <Link to="/signup" className="mt-8 inline-block rounded-lg bg-white px-8 py-3 text-base font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50">
            Start Free 14-Day Trial
          </Link>
          <p className="mt-3 text-sm text-indigo-200">No credit card required. Full access for 14 days.</p>
        </div>
      </main>

      <footer className="border-t border-gray-200 px-6 py-8 text-center text-sm text-gray-400 dark:border-gray-800 dark:text-gray-600">
        Built for trade contractors. &copy; {new Date().getFullYear()} BuildBid.
      </footer>
    </div>
  );
}
