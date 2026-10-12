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
            Hit the button below to download it now — the link is live right away. No spam: if you'd rather not receive estimating tips, unsubscribe any time and we'll stop.
          </p>
          <a
            href="/free-estimating-template-pdf"
            className="inline-block rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition"
            download
          >
            Download Now →
          </a>
          <p className="mt-6 text-sm text-gray-500">
            Want to build estimates online?{" "}
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
          Download our free printable estimating template — pre-built line items with markup on every row,
          plus a customer-ready proposal layout. Fill in your numbers, print it, or copy it into your own spreadsheet.
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
                Free, no credit card. The download link appears right after you submit — and you can unsubscribe from tips anytime.
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
                  title: "Pre-Built Line-Item Layout",
                  desc: "Example rows show quantity, unit, unit cost, markup, and total for each line — swap in your own materials and labor and you're set.",
                },
                {
                  icon: "💰",
                  title: "Clear Markup & Margin",
                  desc: "Every row shows quantity, unit cost, markup %, and total — so your sell price and margin are easy to see before you send the bid.",
                },
                {
                  icon: "📄",
                  title: "Customer-Ready Proposal",
                  desc: "Estimates format into a clean, professional layout you can print or email. Includes space for your logo and terms.",
                },
                {
                  icon: "⏱️",
                  title: "Start From a Template, Not a Blank Grid",
                  desc: "Don't rebuild rows from scratch — fill in the pre-built line items, customize in minutes, and send the same day.",
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

            {/* What you get */}
            <div className="bg-indigo-50 dark:bg-indigo-950 rounded-xl p-6">
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Free, no credit card</p>
              <p className="mt-2 text-sm text-indigo-700 dark:text-indigo-300">
                The download link appears right after you submit. We won't share your email — and if we ever send estimating tips, you can unsubscribe in one click.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 pb-20 text-center">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Want to build estimates online? Try the full BuildBid platform free for 14 days.
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
