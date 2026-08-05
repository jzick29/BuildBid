import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/portal/login")({
  component: PortalLoginPage,
});

function PortalLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/portal/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.user) navigate({ to: "/portal" }); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) navigate({ to: "/portal" });
      else setError(data.error || "Login failed");
    } catch (err: any) { setError(err.message || "Login failed"); }
    finally { setLoading(false); }
  };

  if (checking) {
    return <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-6 dark:bg-gray-950"><p className="text-sm text-gray-500">Loading…</p></div>;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-6 py-12 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</Link>
          <h1 className="mt-4 text-2xl font-bold">Customer Portal</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Sign in to view your proposals, sign documents, and approve change orders.</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">{error}</div>}
          <div className="mb-4">
            <label htmlFor="portal-email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input id="portal-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
              required autoComplete="email" autoFocus />
          </div>
          <div className="mb-6">
            <label htmlFor="portal-password" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <input id="portal-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
              required autoComplete="current-password" />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "Signing in…" : "Sign In"}
          </button>
          <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">A contractor shared this portal with you. Contact them if you need access.</p>
        </form>
      </div>
    </div>
  );
}
