import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";

export const Route = createFileRoute("/templates/marketplace/")({ component: MarketplacePage });

const money = (n: any) => (Number(n) === 0 ? "Free" : "$" + Number(n).toFixed(2));

function Stars({ rating, count }: { rating: number; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-amber-400">
        {"★★★★★".slice(0, Math.round(rating))}{"☆".repeat(Math.max(0, 5 - Math.round(rating)))}
      </span>
      {count > 0 ? <span className="text-gray-500">{rating.toFixed(1)} ({count})</span> : <span className="text-gray-400">No ratings</span>}
    </span>
  );
}

function MarketplacePage() {
  const [user, setUser] = useState<any>(null);
  const [q, setQ] = useState("");
  const [trade, setTrade] = useState("all");
  const [price, setPrice] = useState("all");
  const [sort, setSort] = useState("popular");
  const [listings, setListings] = useState<any[]>([]);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [trades, setTrades] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const call = useCallback(async (fn: string, data: any) => {
    const res = await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: fn, args: { data } }), credentials: "include",
    });
    return res.json();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [searchRes, mineRes] = await Promise.all([
        call("templates.search", { q, trade: trade === "all" ? "" : trade, price, sort }),
        call("templates.getMyListings", {}),
      ]);
      if (searchRes.error) throw new Error(searchRes.error);
      setListings(searchRes.listings || []);
      setMyListings(mineRes.listings || []);
      const t = [...new Set((searchRes.listings || []).map((l: any) => l.trade))].sort();
      setTrades(t);
      setError("");
    } catch (e: any) { setError(e.message || "Failed to load marketplace"); }
    finally { setLoading(false); }
  }, [q, trade, price, sort, call]);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        const meData = await meRes.json();
        if (!meData.user) { window.location.href = "/login"; return; }
        setUser(meData.user);
        await load();
      } catch (e: any) { setError(e.message); setLoading(false); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-install after Stripe checkout returns: /templates/marketplace?paid=1&listing=ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paid = params.get("paid");
    const listingId = params.get("listing");
    if (paid && listingId) {
      (async () => {
        setBusy(listingId);
        const res = await call("templates.install", { listingId });
        setBusy("");
        if (res.error) setError(res.error);
        else if (res.requiresPayment) setError("Payment not completed yet — please try the purchase again.");
        else if (res.installed) setNotice("Template installed to your account!");
        else if (res.alreadyInstalled) setNotice("This template is already installed.");
        await load();
        window.history.replaceState({}, "", "/templates/marketplace/");
      })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const install = async (l: any) => {
    setBusy(l.id);
    setError(""); setNotice("");
    try {
      if (l.price > 0 && !l.purchased) {
        const res = await call("templates.checkout", { listingId: l.id });
        if (res.url) { window.location.href = res.url; return; }
        if (res.error) throw new Error(res.error);
        // devMode — fall through to install
      }
      const res = await call("templates.install", { listingId: l.id });
      if (res.error) throw new Error(res.error);
      if (res.requiresPayment) { window.location.href = `/templates/marketplace/${l.id}`; return; }
      setNotice(res.alreadyInstalled ? "Template already installed." : "Template installed to your account!");
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(""); }
  };

  const unpublish = async (id: string) => {
    if (!confirm("Take this listing down from the marketplace?")) return;
    setBusy(id);
    try {
      const res = await call("templates.unpublish", { listingId: id });
      if (res.error) throw new Error(res.error);
      setNotice("Listing unpublished.");
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(""); }
  };

  const searchNow = () => load();

  if (loading && !listings.length && !myListings.length) {
    return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading marketplace…</p></div>;
  }
  if (!user) return null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Marketplace</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Community-built estimating templates — install free or paid, then rate what you use.</p>
        </div>
        <Link to="/templates" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900">My Templates</Link>
      </div>

      {notice && <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">{notice}</div>}
      {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</div>}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="relative min-w-56 flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchNow()}
            placeholder="Search templates, tags…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
          />
        </div>
        <select value={trade} onChange={(e) => { setTrade(e.target.value); setTimeout(searchNow, 0); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950">
          <option value="all">All trades</option>
          {trades.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
        <select value={price} onChange={(e) => { setPrice(e.target.value); setTimeout(searchNow, 0); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950">
          <option value="all">Any price</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setTimeout(searchNow, 0); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950">
          <option value="popular">Most popular</option>
          <option value="newest">Newest</option>
          <option value="rating">Top rated</option>
        </select>
        <button onClick={searchNow} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Search</button>
      </div>

      {/* My listings */}
      {myListings.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Your Listings</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Trade</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Price</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Installs</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Rating</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {myListings.map((l: any) => (
                  <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                    <td className="px-4 py-3 font-medium"><Link to={`/templates/marketplace/$listingId`} params={{ listingId: l.id }} className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">{l.title}</Link></td>
                    <td className="px-4 py-3 capitalize text-gray-600 dark:text-gray-400">{l.trade}</td>
                    <td className="px-4 py-3 text-right">{money(l.price)}</td>
                    <td className="px-4 py-3 text-right">{l.downloads}</td>
                    <td className="px-4 py-3 text-right">{l.ratingCount ? `${l.avgRating}★ (${l.ratingCount})` : "—"}</td>
                    <td className="px-4 py-3 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.isPublished ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>{l.isPublished ? "Live" : "Hidden"}</span></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => unpublish(l.id)} disabled={busy === l.id || !l.isPublished} className="text-xs font-medium text-red-500 hover:text-red-400 disabled:opacity-40">Unpublish</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Browse grid */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">{listings.length} {listings.length === 1 ? "Listing" : "Listings"}</h2>
        {loading ? (
          <p className="mt-4 text-gray-500">Searching…</p>
        ) : listings.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">No templates match your search.</p>
            <p className="mt-1 text-sm text-gray-400">Publish one of your custom templates to be the first in this category.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l: any) => (
              <div key={l.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-800">
                <Link to={`/templates/marketplace/$listingId`} params={{ listingId: l.id }} className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{l.trade}</span>
                    <span className={`text-sm font-bold ${l.price > 0 ? "text-gray-900 dark:text-gray-100" : "text-green-600 dark:text-green-400"}`}>{money(l.price)}</span>
                  </div>
                  <h3 className="mt-3 font-semibold text-gray-900 dark:text-gray-100">{l.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{l.description || "No description provided."}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>by {l.authorName}</span>
                    <span>{l.downloads} installs</span>
                  </div>
                  <div className="mt-1"><Stars rating={l.avgRating} count={l.ratingCount} /></div>
                  {l.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {l.tags.slice(0, 3).map((t: string) => <span key={t} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">#{t}</span>)}
                    </div>
                  )}
                </Link>
                <div className="mt-4">
                  {l.installed ? (
                    <span className="block rounded-lg bg-green-100 px-3 py-2 text-center text-sm font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400">Installed ✓</span>
                  ) : l.isMine ? (
                    <Link to={`/templates/marketplace/$listingId`} params={{ listingId: l.id }} className="block rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Manage Listing</Link>
                  ) : (
                    <button
                      onClick={() => install(l)}
                      disabled={busy === l.id}
                      className="block w-full rounded-lg bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {busy === l.id ? "Working…" : l.price > 0 && !l.purchased ? `Buy · ${money(l.price)}` : "Install Free"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
