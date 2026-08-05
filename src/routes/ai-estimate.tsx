import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AiEstimator } from "../components/AiEstimator";

export const Route = createFileRoute("/ai-estimate")({
  loader: async () => ({}),
  component: AiEstimatePage,
});

function AiEstimatePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) { window.location.href = "/login"; return; }
        setUser(d.user);
      })
      .catch(() => { window.location.href = "/login"; })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link to="/estimates" className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">&larr; Back to estimates</Link>
      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Estimate</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
            Describe the job in plain English and get a populated, editable estimate with realistic line items,
            labor hours, and recommended markup — ready to refine and send.
          </p>
        </div>
      </div>
      <div className="mt-8">
        <AiEstimator />
      </div>
    </div>
  );
}
