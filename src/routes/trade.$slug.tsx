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
  "concrete-estimating": {
    slug: "concrete-estimating",
    tradeType: "concrete",
    title: "Concrete Estimating Software",
    subtitle: "Accurate concrete bids for flatwork, foundations, driveways, and decorative concrete — fast and precise.",
    description: "Concrete estimating is all about yards, square footage, and labor. BuildBid's templates for driveways, patios, sidewalks, foundations, and stamped concrete handle the material calculations so you price every job accurately — from the first yard to the last broom finish.",
    valueProps: [
      { icon: "🧱", title: "Pre-built concrete assemblies", desc: "Driveways, patios, slab foundations, stamped concrete, and retaining walls — with real mix pricing and labor estimates." },
      { icon: "🧮", title: "Automatic yardage calculations", desc: "Enter dimensions and the template calculates concrete yards, rebar, wire mesh, forms, and finishing labor." },
      { icon: "📋", title: "Professional proposals that close", desc: "Turn your concrete takeoff into a branded, customer-ready proposal with line items, terms, and digital signature." },
    ],
    ctaTitle: "Pour more profit into every concrete job",
    ctaBody: "Estimate driveways, patios, and foundations in under 30 minutes. Start your free trial — no credit card needed.",
  },
  "drywall-estimating": {
    slug: "drywall-estimating",
    tradeType: "drywall",
    title: "Drywall Estimating Software",
    subtitle: "Price drywall jobs by the sheet with pre-built assemblies for hanging, taping, and finishing.",
    description: "Drywall estimating lives and dies by the board count. BuildBid's templates for standard 1/2-inch, 5/8-inch fire-rated, moisture-resistant, and soundproof drywall have the sheets, screws, tape, mud, corner bead, and labor rates pre-loaded — so your takeoff becomes a finished estimate in minutes.",
    valueProps: [
      { icon: "📐", title: "Pre-built drywall assemblies", desc: "Standard 1/2-inch walls, 5/8-inch fire-rated, green board moisture-resistant, and soundproof assemblies — with screws, tape, and mud included." },
      { icon: "🔢", title: "Board count and labor calculator", desc: "Enter wall and ceiling square footage — the template calculates board count, fasteners, bead, and hanging/finishing labor." },
      { icon: "📄", title: "Scope of work included", desc: "Every proposal spells out what's included: hang, tape, texture, sanding. No disputes about scope after the fact." },
    ],
    ctaTitle: "Stop counting sheets by hand — estimate drywall in minutes",
    ctaBody: "Pre-built drywall templates with real material pricing and labor rates. Start your free trial today.",
  },
  "landscaping-estimating": {
    slug: "landscaping-estimating",
    tradeType: "landscaping",
    title: "Landscaping Estimating Software",
    subtitle: "Estimate landscaping, hardscaping, irrigation, and lawn care with professional templates.",
    description: "Landscaping estimates span a huge range — from $500 mulch jobs to $50,000 paver patios with irrigation and lighting. BuildBid's templates for lawn installation, planting beds, paver patios, retaining walls, and irrigation systems give you flexible starting points that scale from small residential to large commercial projects.",
    valueProps: [
      { icon: "🌿", title: "Pre-built landscaping assemblies", desc: "Sod installation, planting beds, paver patios, retaining walls, irrigation systems, and landscape lighting — priced and ready." },
      { icon: "📏", title: "Per-square-foot pricing made easy", desc: "Set your price per square foot for sod, mulch, gravel, and pavers — the template handles the math for any project size." },
      { icon: "📸", title: "Photo-ready proposals", desc: "Include before/after photos and plant lists in your proposals. Show customers exactly what they're paying for." },
    ],
    ctaTitle: "Grow your landscaping business with professional estimating",
    ctaBody: "From lawn care to hardscapes — estimate every job with confidence. Start your free 14-day trial.",
  },
  "painting-estimating": {
    slug: "painting-estimating",
    tradeType: "painting",
    title: "Painting Estimating Software",
    subtitle: "Price painting jobs with confidence — from single rooms to full commercial buildings.",
    description: "Painting estimates are all about square footage, surface prep, and coatings. BuildBid's templates for interior painting, exterior painting, cabinet refinishing, and commercial painting handle the math — wall area, ceiling area, trim linear feet, coating gallons — so your estimates are fast, accurate, and professional.",
    valueProps: [
      { icon: "🎨", title: "Pre-built painting assemblies", desc: "Interior rooms, full exteriors, cabinet refinishing, and commercial tenant improvements — with real coating coverage rates and labor estimates." },
      { icon: "📐", title: "Automatic square footage calculations", desc: "Enter room dimensions and the template calculates wall and ceiling area, trim linear feet, and gallon requirements. No more manual math." },
      { icon: "📋", title: "Detailed scope of work in every proposal", desc: "Surface prep, primer coats, finish coats, sheen levels — spelled out so customers know exactly what they're paying for." },
    ],
    ctaTitle: "Stop estimating painting jobs on napkins — go pro in 14 days free",
    ctaBody: "Pre-built painting templates with current coating pricing and realistic labor rates. Start your free trial now.",
  },
  "flooring-estimating": {
    slug: "flooring-estimating",
    tradeType: "flooring",
    title: "Flooring Estimating Software",
    subtitle: "Estimate hardwood, tile, carpet, LVP, and refinishing jobs with pre-built templates.",
    description: "Flooring estimates need to account for material, underlayment, transitions, baseboards, and waste — plus labor for demo, prep, and installation. BuildBid's templates for hardwood, tile, luxury vinyl plank, carpet, and refinishing handle all of it so every bid is accurate from the first square foot to the last transition strip.",
    valueProps: [
      { icon: "🪵", title: "Pre-built flooring assemblies", desc: "Solid hardwood, engineered wood, ceramic tile, LVP, carpet, and sand-and-refinish — with underlayment, transitions, and baseboards included." },
      { icon: "🧮", title: "Waste factor built in", desc: "Templates automatically add 5–20% material waste based on flooring type and layout pattern. No more running short on the last row." },
      { icon: "📄", title: "Line-item transparency", desc: "Every proposal shows material per square foot, labor per square foot, and separate line items for demo, prep, and trim work. Customers see the value." },
    ],
    ctaTitle: "Price every flooring job down to the square foot",
    ctaBody: "From carpet to hardwood — estimate flooring jobs in minutes, not hours. Start your free 14-day trial.",
  },
  "framing-carpentry-estimating": {
    slug: "framing-carpentry-estimating",
    tradeType: "framing",
    title: "Framing & Carpentry Estimating Software",
    subtitle: "Estimate framing, finish carpentry, decks, and millwork with accurate material and labor calculations.",
    description: "Framing and carpentry estimates involve hundreds of individual pieces — studs, plates, headers, joists, rafters, sheathing, trim, and hardware. BuildBid's templates for wall framing, floor systems, roof framing, deck construction, and finish carpentry organize every piece so nothing gets left out of the bid.",
    valueProps: [
      { icon: "🪚", title: "Pre-built framing assemblies", desc: "Wall framing (per linear foot), floor joist systems, roof truss packages, deck framing, and interior trim packages — with real lumber pricing." },
      { icon: "📏", title: "Component-level material lists", desc: "Every 2x4, sheet of sheathing, pound of nails, and tube of adhesive is counted. Templates generate complete material lists you can hand to your supplier." },
      { icon: "📑", title: "Labor by the piece", desc: "Set labor rates per stud, per sheet, per linear foot of trim — and the template calculates total labor automatically. Consistent pricing on every bid." },
    ],
    ctaTitle: "Frame every estimate with confidence — from rough to finish",
    ctaBody: "Pre-built framing and carpentry templates for the most common residential and light commercial projects. Start your free trial.",
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
    concrete: "bg-stone-100 text-stone-800 dark:bg-stone-950 dark:text-stone-300",
    drywall: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
    landscaping: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    painting: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
    flooring: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    framing: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
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
