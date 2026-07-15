import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { requestPasswordReset } from "~/lib/auth";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestPasswordReset({ data: { email } });
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-6 dark:bg-gray-950">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Link to="/" className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
              BuildBid
            </Link>
            <h1 className="mt-4 text-2xl font-bold">Check your email</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              If an account exists for {email}, we've sent a password reset link.
            </p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center dark:border-green-900 dark:bg-green-950/30">
            <p className="text-sm text-green-800 dark:text-green-300">
              Please check your inbox and click the reset link.
            </p>
            <p className="mt-2 text-xs text-green-700 dark:text-green-400">
              Didn't receive it? Check your spam folder or{" "}
              <button onClick={() => setSent(false)} className="font-medium underline hover:no-underline">
                try again
              </button>
            </p>
          </div>
          <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-6 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            BuildBid
          </Link>
          <h1 className="mt-4 text-2xl font-bold">Reset your password</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Enter your email and we'll send you a reset link
          </p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
              {error}
            </div>
          )}
          <div className="mb-4">
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
              required
              autoComplete="email"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
          <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
            Remember your password?{" "}
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}