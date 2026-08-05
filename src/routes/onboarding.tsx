import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";

const TRADES = ["Electrical", "Plumbing", "HVAC", "Roofing", "General Contractor"];

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [trade, setTrade] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade, phone, company_name: companyName }),
        credentials: "include",
      });
      // Optionally create first estimate if project name provided
      if (projectName && customerName) {
        await fetch("/api/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            function: "estimates.create",
            args: { data: { project_name: projectName, customer_name: customerName, trade } },
          }),
          credentials: "include",
        });
      }
      router.navigate({ to: "/dashboard" });
    } catch (e) {
      router.navigate({ to: "/dashboard" });
    }
  };

  const handleSkip = async () => {
    setSkipping(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade: trade || "General Contractor", phone: "", company_name: companyName }),
        credentials: "include",
      });
    } catch (e) { /* proceed anyway */ }
    router.navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-6 dark:bg-gray-950">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            BuildBid
          </span>
          <h1 className="mt-4 text-2xl font-bold">Let's get you set up</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Step {step} of 3 — this only takes a minute
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8 flex gap-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Trade & Contact */}
        {step === 1 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-1 text-lg font-semibold">What trade are you in?</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">We'll tailor templates and materials for your trade.</p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {TRADES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrade(t)}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    trade === t
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-300"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
                placeholder="Your business name"
              />
            </div>
            <div className="mb-6">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Phone <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={handleSkip} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
                Skip for now
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!trade}
                className="ml-auto rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Create First Estimate */}
        {step === 2 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-1 text-lg font-semibold">Create your first estimate</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Jump right in — create a quick estimate for a project.
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
                placeholder="e.g. Kitchen remodel"
              />
            </div>
            <div className="mb-6">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
                placeholder="e.g. John Smith"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="ml-auto rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Ready */}
        {step === 3 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
              <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold">You're all set!</h2>
            <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
              Trade: <strong>{trade}</strong>
            </p>
            {projectName && (
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                First project: <strong>{projectName}</strong> for <strong>{customerName}</strong>
              </p>
            )}
            {!projectName && (
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                You can create your first estimate anytime from the dashboard.
              </p>
            )}
            <button
              onClick={handleComplete}
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Finishing up..." : "Go to Dashboard"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
