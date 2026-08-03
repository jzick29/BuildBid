import { createFileRoute, Link } from "@tanstack/react-router";

const SIGNUP_URL = "https://site-delta-seven-64.vercel.app/signup";

export const Route = createFileRoute("/share")({
  component: SharePage,
});

function SharePage() {
  const shareText = `I've been using BuildBid for construction estimating — it replaces spreadsheets with pre-built templates and professional proposals. Try it free: ${SIGNUP_URL}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareText).catch(() => {});
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Dashboard</Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-10 text-center dark:border-indigo-800 dark:bg-indigo-950/30">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
            <svg className="h-8 w-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
          </span>
          <h1 className="mt-6 text-3xl font-bold text-indigo-900 dark:text-indigo-300">Share BuildBid with your crew</h1>
          <p className="mt-3 text-indigo-700 dark:text-indigo-400">
            If BuildBid is helping you win more work, share it with other contractors. They get
            a 14-day free trial — no credit card needed.
          </p>

          <div className="mt-8 rounded-lg border border-indigo-200 bg-white p-4 text-left dark:border-indigo-800 dark:bg-gray-900">
            <p className="text-sm text-gray-700 dark:text-gray-300">{shareText}</p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={copyToClipboard}
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Copy Share Message
            </button>
            <a
              href={`mailto:?subject=Check out BuildBid for estimating&body=${encodeURIComponent(shareText)}`}
              className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
            >
              Share via Email
            </a>
          </div>

          <p className="mt-6 text-xs text-indigo-500 dark:text-indigo-400">
            Or send them directly to: <Link to="/signup" className="font-medium underline">{SIGNUP_URL}</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
