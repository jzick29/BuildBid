import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { validateResetToken, resetPassword } from "~/lib/auth";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, string>) => ({
    token: search.token as string | undefined,
  }),
  loaderDeps: ({ search: { token } }) => ({ token }),
  loader: async ({ deps: { token } }) => {
    if (!token) return { valid: false, token: null };
    const result = await validateResetToken({ data: { token } });
    return { valid: result.valid, token };
  },
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const router = useRouter();
  const { valid, token } = Route.useLoaderData();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ data: { token: token!, password } });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!valid) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-6 dark:bg-gray-950">
        <div className="w-full max-w-sm text-center">
          <Link to="/" className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            BuildBid
          </Link>
          <h1 className="mt-4 text-2xl font-bold">Invalid or expired link</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            This password reset link is invalid or has expired.
          </p>
          <Link to="/forgot-password" className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-6 dark:bg-gray-950">
        <div className="w-full max-w-sm text-center">
          <Link to="/" className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            BuildBid
          </Link>
          <h1 className="mt-4 text-2xl font-bold">Password reset successful</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <Link to="/login" className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Sign in
          </Link>
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
          <h1 className="mt-4 text-2xl font-bold">Set new password</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Enter your new password below
          </p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
              {error}
            </div>
          )}
          <div className="mb-4">
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirm Password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
          <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}