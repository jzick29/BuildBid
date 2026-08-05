import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";

export const Route = createFileRoute("/templates/marketplace/$listingId")({ component: ListingDetailPage });

const money = (n: any) => (Number(n) === 0 ? "Free" : "$" + Number(n).toFixed(2));
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";

function ListingDetailPage() {
  const { listingId } = Route.useParams();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [myRating, setMyRating] = useState(5);
  const [myReview, setMyReview] = useState("");

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
      const res = await call("templates.getListing", { id: listingId });
      if (res.error) throw new Error(res.error);
      setListing(res.listing);
      if (res.listing.myRating) { setMyRating(res.listing.myRating.rating); setMyReview(res.listing.myRating.review || ""); }
      setError("");
    } catch (e: any) { setError(e.message || "Failed to load listing"); }
    finally { setLoading(false); }
  }, [listingId, call]);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      if (!meData.user) { window.location.href = "/login"; return; }
      await load();
    })();
  }, [load]);

  const purchase = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await call("templates.checkout", { listingId });
      if (res.error) throw new Error(res.error);
      if (res.free || res.purchased || res.devMode) {
        const installRes = await call("templates.install", { listingId });
        if (installRes.error) throw new Error(installRes.error);
        setNotice(installRes.alreadyInstalled ? "Template already installed." : "Template installed to your account!");
        await load();
      } else if (res.url) {
        window.location.href = res.url;
      }
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const rate = async () => {
    setBusy(true); setError("");
    try {
      const res = await call("templates.rate", { listingId, rating: myRating, review: myReview });
      if (res.error) throw new Error(res.error);
      setNotice("Thanks for your review!");
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (loading && !listing) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading…</p></div>;
  if (!listing) return <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12"><p className="text-red-500">{error}</p><Link to="/templates/marketplace" className="mt-4 inline-block text-indigo-600 underline">← Back to Marketplace</Link></main>;

  const itemTotal = (i: any) => (i.quantity || 0) * (i.unitCost || 0) * (1 + (i.markupPercent || 0) / 100);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <Link to="/templates/marketplace" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">← Back to Marketplace</Link>

      {notice && <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">{notice}</div>}
      {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</div>}

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{listing.trade}</span>
              {listing.installed && <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400">Installed</span>}
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">{listing.title}</h1>
            <p className="mt-1 text-sm text-gray-500">by {listing.authorName} · {listing.downloads} installs · published {fmtDate(listing.createdAt)}</p>
            <div className="mt-2 text-sm"><span className="text-amber-400">{"★★★★★".slice(0, Math.round(listing.avgRating))}</span>{" "}{listing.ratingCount ? `${listing.avgRating.toFixed(1)} (${listing.ratingCount} ratings)` : "No ratings yet"}</div>
            {listing.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {listing.tags.map((t: string) => <span key={t} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">#{t}</span>)}
              </div>
            )}
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${listing.price > 0 ? "text-gray-900 dark:text-gray-100" : "text-green-600 dark:text-green-400"}`}>{money(listing.price)}</p>
            {listing.isMine ? (
              <p className="mt-2 text-sm text-gray-500">This is your listing</p>
            ) : listing.installed ? (
              <Link to="/templates" className="mt-2 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">Use in Templates →</Link>
            ) : (
              <button onClick={purchase} disabled={busy} className="mt-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {busy ? "Working…" : listing.price > 0 && !listing.purchased ? `Buy for ${money(listing.price)}` : "Install Free"}
              </button>
            )}
          </div>
        </div>

        {listing.description && (
          <div className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-950 dark:text-gray-300">
            {listing.description}
          </div>
        )}
      </div>

      {/* Line items preview */}
      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="bg-white px-6 pt-6 dark:bg-gray-900"><h2 className="text-lg font-semibold">What's Inside ({listing.items.length} line items)</h2></div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-950">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Description</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Unit</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Unit Cost</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Markup</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {listing.items.map((i: any) => (
                <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                  <td className="px-4 py-3">{i.description}</td>
                  <td className="px-4 py-3 text-right">{i.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{i.unit}</td>
                  <td className="px-4 py-3 text-right">{money(i.unitCost)}</td>
                  <td className="px-4 py-3 text-right">{i.markupPercent}%</td>
                  <td className="px-4 py-3 text-right font-medium">{money(itemTotal(i))}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 dark:bg-gray-950">
                <td colSpan={5} className="px-4 py-3 text-right font-semibold">Estimated Total (before tax)</td>
                <td className="px-4 py-3 text-right font-bold">{money(listing.items.reduce((s: number, i: any) => s + itemTotal(i), 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Rating form */}
      {listing.installed && !listing.isMine && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold">Rate this Template</h2>
          <div className="mt-3 flex gap-1 text-2xl">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setMyRating(s)} className={s <= myRating ? "text-amber-400" : "text-gray-300 dark:text-gray-600"}>{s <= myRating ? "★" : "☆"}</button>
            ))}
          </div>
          <textarea value={myReview} onChange={(e) => setMyReview(e.target.value)} placeholder="How was it? Easy to adapt? Accurate pricing?" rows={3} className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
          <button onClick={rate} disabled={busy} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Submit Review</button>
        </div>
      )}

      {/* Reviews */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold">Reviews {listing.ratings.length > 0 && `(${listing.ratings.length})`}</h2>
        {listing.ratings.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No reviews yet — be the first to rate this template.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {listing.ratings.map((r: any, idx: number) => (
              <div key={idx} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.userName}</span>
                  <span className="text-sm text-amber-400">{"★".repeat(Math.max(0, Math.min(5, r.rating)))}</span>
                </div>
                {r.review && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{r.review}</p>}
                <p className="mt-2 text-xs text-gray-400">{fmtDate(r.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
