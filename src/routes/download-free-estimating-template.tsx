// Lead Magnet Landing Page: /download-free-estimating-template
// Copy into src/routes/ as download-free-estimating-template.tsx

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

function getUtmSource(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const parts: string[] = [];
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const val = params.get(key);
    if (val) parts.push(`${key}=${encodeURIComponent(val)}`);
  }
  return parts.join("&");
}

export const Route = createFileRoute("/download-free-estimating-template")({
  component: DownloadTemplatePage,
});

function DownloadTemplatePage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("electrical");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: "leads.submit",
          args: { data: { name: name.trim(), email: email.trim(), trade, source: "free-template-download" + (getUtmSource() ? "&" + getUtmSource() : "") } },
        }),
      });
      if (res.ok) setSubmitted(true);
      else setError("Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-10 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h1 className="text-2xl font-bold mb-2">Your Template Is Ready!</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We've sent the download link to <strong>{email}</strong>. Check your inbox (and spam folder) in the next few minutes.
          </p>
          <a
            href="/free-estimating-template-pdf"
            className="inline-block rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition"
            download
          >
            Download Now →
          </a>
          <p className="mt-6 text-sm text-gray-500">
            Want to try the full platform?{" "}
            <Link to="/signup" className="text-indigo-600 hover:text-indigo-500 font-medium">
              Start your 14-day free trial →
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <section className="px-6 py-20 text-center">
        <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Free Download</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Free {trade === "electrical" ? "Electrical" : trade === "hvac" ? "HVAC" : trade === "plumbing" ? "Plumbing" : trade === "roofing" ? "Roofing" : "Construction"} Estimating Template
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Download our professional estimating spreadsheet — pre-built with line items, markup formulas, and a
          customer-ready proposal format. Used by 500+ contractors to win more work.
        </p>
      </section>

      {/* Form + Benefits */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-5xl grid gap-12 lg:grid-cols-2">
          {/* Form */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8">
            <h2 className="text-xl font-semibold mb-6">Get Your Free Template</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="John Smith"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trade</label>
                <select
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="electrical">Electrical</option>
                  <option value="hvac">HVAC</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="roofing">Roofing</option>
                  <option value="general">General Contracting</option>
                </select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {submitting ? "Sending..." : "Get My Free Template"}
              </button>
              <p className="text-xs text-gray-500 text-center">
                No spam, ever. Unsubscribe anytime. We'll send the template and occasional estimating tips.
              </p>
            </form>
          </div>

          {/* Benefits */}
          <div className="space-y-8">
            <h2 className="text-xl font-semibold">What's Inside</h2>
            <div className="space-y-6">
              {[
                {
                  icon: "📊",
                  title: "Pre-Built Line Items",
                  desc: `Common ${trade === "electrical" ? "electrical" : trade === "hvac" ? "HVAC" : trade === "plumbing" ? "plumbing" : trade === "roofing" ? "roofing" : "construction"} assemblies ready to use — panel upgrades, circuit runs, fixture installs, and more.`,
                },
                {
                  icon: "💰",
                  title: "Automatic Markup & Margin",
                  desc: "Formulas built in. Enter your material cost, set your markup %, and the spreadsheet calculates your sell price and margin automatically.",
                },
                {
                  icon: "📄",
                  title: "Customer-Ready Proposal",
                  desc: "Estimates format into a clean, professional proposal you can print or email. Includes space for your logo and terms.",
                },
                {
                  icon: "⏱️",
                  title: "Save 2–3 Hours Per Bid",
                  desc: "Stop reinventing the wheel. Start from templates, customize in minutes, and send proposals the same day.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="text-2xl shrink-0">{item.icon}</div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{item.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div className="bg-indigo-50 dark:bg-indigo-950 rounded-xl p-6">
              <p className="text-sm text-indigo-700 dark:text-indigo-300 italic">
                "This template saved me 3 hours on my first bid. The markup formulas alone are worth it."
              </p>
              <p className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                — Mike R., Licensed Electrician, 12 years
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 pb-20 text-center">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Want more than a spreadsheet? Try the full BuildBid platform free for 14 days.
        </p>
        <Link
          to="/signup"
          className="inline-block rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition"
        >
          Start Free Trial →
        </Link>
      </section>
    </div>
  );
}
