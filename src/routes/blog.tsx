import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { blogPosts, type BlogPost } from "~/lib/blog-posts";

export const Route = createFileRoute("/blog")({
  loader: async () => ({}),
  component: BlogPage,
  head: () => ({
    meta: [
      { title: "Blog — BuildBid | Construction Estimating Tips" },
      { name: "description", content: "Expert tips for trade contractors on estimating, bidding, and winning more profitable work." },
    ],
  }),
});

function BlogPage() {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [estimateCount, setEstimateCount] = useState(0);

  useEffect(() => {
    fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "blog.getBlogStats", args: {} }),
    })
    .then(r => r.json())
    .then(d => { if (d?.estimateCount) setEstimateCount(d.estimateCount); })
    .catch(() => {});
  }, []);

  if (selectedPost) {
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="border-b border-gray-200 dark:border-gray-800">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link to="/" className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</Link>
            <div className="flex items-center gap-4 text-sm">
              <Link to="/blog" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">← All Posts</Link>
              <Link to="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Start Free Trial</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
          <article>
            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{selectedPost.category}</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">{selectedPost.title}</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{new Date(selectedPost.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
            <div className="mt-8 space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:dark:text-gray-100 [&_h2]:mt-10 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:dark:text-gray-100 [&_h3]:mt-8 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_li]:text-gray-700 [&_li]:dark:text-gray-300 [&_strong]:text-gray-900 [&_strong]:dark:text-gray-100" dangerouslySetInnerHTML={{ __html: selectedPost.content }} />
          </article>
          <div className="mt-12 rounded-xl bg-indigo-50 border border-indigo-200 p-8 text-center dark:bg-indigo-950/30 dark:border-indigo-800">
            <h2 className="text-xl font-bold text-indigo-900 dark:text-indigo-300">Stop estimating from scratch</h2>
            <p className="mt-2 text-indigo-700 dark:text-indigo-400">
              BuildBid gives you pre-built assemblies, professional proposals, and win/loss tracking.
              {estimateCount > 0 && <> Join {estimateCount.toLocaleString()}+ estimates already created on the platform.</>}
            </p>
            <Link to="/signup" className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
              Start Free 14-Day Trial
            </Link>
            <p className="mt-3 text-xs text-indigo-500 dark:text-indigo-400">No credit card required</p>
          </div>
        </main>
        <footer className="border-t border-gray-200 px-6 py-8 text-center text-sm text-gray-400 dark:border-gray-800 dark:text-gray-600">
          Built for trade contractors. &copy; {new Date().getFullYear()} BuildBid.
        </footer>
      </div>
    );
  }

  // Blog index — list all posts
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

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight">BuildBid Blog</h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
          Expert tips for trade contractors on estimating, bidding, and winning more profitable work.
        </p>

        <div className="mt-12 space-y-8">
          {blogPosts.map(post => (
            <article key={post.slug} className="rounded-xl border border-gray-200 p-6 hover:border-indigo-300 transition-colors cursor-pointer dark:border-gray-800 dark:hover:border-indigo-700" onClick={() => setSelectedPost(post)}>
              <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{post.category}</p>
              <h2 className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400">{post.title}</h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
              <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">{post.excerpt}</p>
              <span className="mt-3 inline-block text-sm font-medium text-indigo-600 dark:text-indigo-400">Read more →</span>
            </article>
          ))}
        </div>

        <div className="mt-16 rounded-xl bg-indigo-50 border border-indigo-200 p-8 text-center dark:bg-indigo-950/30 dark:border-indigo-800">
          <h2 className="text-xl font-bold text-indigo-900 dark:text-indigo-300">Ready to win more bids?</h2>
          <p className="mt-2 text-indigo-700 dark:text-indigo-400">
            Start your free trial and create your first professional estimate in minutes.
            {estimateCount > 0 && <> Join {estimateCount.toLocaleString()}+ estimates already created.</>}
          </p>
          <Link to="/signup" className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
            Start Free 14-Day Trial
          </Link>
          <p className="mt-3 text-xs text-indigo-500 dark:text-indigo-400">No credit card required</p>
        </div>
      </main>

      <footer className="border-t border-gray-200 px-6 py-8 text-center text-sm text-gray-400 dark:border-gray-800 dark:text-gray-600">
        Built for trade contractors. &copy; {new Date().getFullYear()} BuildBid.
      </footer>
    </div>
  );
}
