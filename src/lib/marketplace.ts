// Template Marketplace — publish/search/install/rate listings.
// Registered as makeAuthFn handlers so they work in dev (registry) and prod (vercel-entry switch).
import { makeAuthFn } from "./iso";
import type { Pool } from "@neondatabase/serverless";

function num(v: any): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
function round2(n: number) { return Math.round(n * 100) / 100; }

/** Map a listing row + rating aggregates to a clean API object */
function shape(l: any) {
  return {
    id: l.id, templateId: l.template_id, title: l.title, description: l.description,
    trade: l.trade, tags: (l.tags || "").split(",").filter(Boolean),
    price: round2(num(l.price_cents) / 100), priceCents: num(l.price_cents),
    downloads: parseInt(l.downloads || 0), authorName: l.author_name || "",
    avgRating: round2(num(l.avg_rating)), ratingCount: parseInt(l.rating_count || 0),
    createdAt: l.created_at, installed: !!parseInt(l.installed || 0), purchased: !!parseInt(l.purchased || 0),
    isMine: !!parseInt(l.is_mine || 0),
  };
}

// ---------------------------------------------------------------------------
// templates.publish — create/update a public listing from one of the user's templates
// ---------------------------------------------------------------------------
export const publishListing = makeAuthFn("templates.publish", async (args, userId, pool) => {
  const d = args?.data || {};
  if (!d.templateId) throw new Error("Template is required");
  const title = String(d.title || "").trim();
  if (!title) throw new Error("A title is required");
  if (title.length > 120) throw new Error("Title must be under 120 characters");
  const price = num(d.price);
  if (price < 0 || (price > 0 && (price < 4.99 || price > 49.99))) {
    throw new Error("Price must be Free, or between $4.99 and $49.99");
  }
  const tpl = (await pool.query("SELECT * FROM templates WHERE id=$1", [d.templateId])).rows[0];
  if (!tpl) throw new Error("Template not found");
  if (tpl.user_id && tpl.user_id !== userId) throw new Error("You can only publish your own templates");

  const existing = (await pool.query("SELECT id FROM template_listings WHERE template_id=$1 AND user_id=$2", [d.templateId, userId])).rows[0];
  const priceCents = Math.round(price * 100);
  const trade = (d.trade || tpl.trade_type || "general").trim();
  const tags = String(d.tags || "").split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10).join(",");
  const description = String(d.description || "").trim();
  let listingId: string;
  if (existing) {
    listingId = existing.id;
    await pool.query(
      "UPDATE template_listings SET title=$1, description=$2, trade=$3, tags=$4, price_cents=$5, is_published=1, updated_at=NOW() WHERE id=$6",
      [title, description, trade, tags, priceCents, listingId]);
  } else {
    listingId = crypto.randomUUID();
    await pool.query(
      "INSERT INTO template_listings (id, template_id, user_id, title, description, trade, tags, price_cents) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [listingId, d.templateId, userId, title, description, trade, tags, priceCents]);
  }
  return { listingId, price: priceCents / 100 };
});

// ---------------------------------------------------------------------------
// templates.unpublish — take a listing down
// ---------------------------------------------------------------------------
export const unpublishListing = makeAuthFn("templates.unpublish", async (args, userId, pool) => {
  const d = args?.data || {};
  const res = await pool.query("UPDATE template_listings SET is_published=0, updated_at=NOW() WHERE id=$1 AND user_id=$2", [d.listingId, userId]);
  if (!res.rowCount) throw new Error("Listing not found");
  return { success: true };
});

// ---------------------------------------------------------------------------
// templates.getMyListings — the current user's published listings
// ---------------------------------------------------------------------------
export const getMyListings = makeAuthFn("templates.getMyListings", async (_args, userId, pool) => {
  const rows = (await pool.query(
    `SELECT l.*, u.name AS author_name,
       (SELECT COUNT(*) FROM template_installs ti WHERE ti.listing_id = l.id) AS installs,
       COALESCE((SELECT AVG(tr.rating) FROM template_ratings tr WHERE tr.listing_id = l.id), 0) AS avg_rating,
       (SELECT COUNT(*) FROM template_ratings tr2 WHERE tr2.listing_id = l.id) AS rating_count
     FROM template_listings l JOIN users u ON u.id = l.user_id
     WHERE l.user_id = $1 ORDER BY l.created_at DESC`, [userId])).rows;
  return { listings: rows.map((r: any) => ({
    id: r.id, title: r.title, trade: r.trade, price: round2(num(r.price_cents) / 100),
    isPublished: !!r.is_published, downloads: parseInt(r.installs || 0),
    avgRating: round2(num(r.avg_rating)), ratingCount: parseInt(r.rating_count || 0), createdAt: r.created_at,
  })) };
});

// ---------------------------------------------------------------------------
// templates.search — browse published listings
// ---------------------------------------------------------------------------
export const searchListings = makeAuthFn("templates.search", async (args, userId, pool) => {
  const d = args?.data || {};
  const conds: string[] = ["l.is_published = 1"];
  const params: any[] = [userId];

  if (d.q && String(d.q).trim()) {
    const q = "%" + String(d.q).trim().toLowerCase() + "%";
    params.push(q);
    conds.push(`(LOWER(l.title) LIKE $${params.length} OR LOWER(l.description) LIKE $${params.length} OR LOWER(l.tags) LIKE $${params.length})`);
  }
  if (d.trade && d.trade !== "all") { params.push(d.trade); conds.push(`l.trade = $${params.length}`); }
  if (d.price === "free") conds.push("l.price_cents = 0");
  if (d.price === "paid") conds.push("l.price_cents > 0");

  const sort =
    d.sort === "newest" ? "l.created_at DESC" :
    d.sort === "rating" ? "avg_rating DESC NULLS LAST" :
    "l.downloads DESC, l.created_at DESC";

  const rows = (await pool.query(
    `SELECT l.*, u.name AS author_name,
       COALESCE((SELECT AVG(tr.rating) FROM template_ratings tr WHERE tr.listing_id = l.id), 0) AS avg_rating,
       (SELECT COUNT(*) FROM template_ratings tr2 WHERE tr2.listing_id = l.id) AS rating_count,
       (SELECT COUNT(*) FROM template_installs ti WHERE ti.listing_id = l.id AND ti.user_id = $1 AND ti.status = 'installed') AS installed,
       (SELECT COUNT(*) FROM template_installs ti3 WHERE ti3.listing_id = l.id AND ti3.user_id = $1 AND ti3.status = 'paid') AS purchased,
       CASE WHEN l.user_id = $1 THEN 1 ELSE 0 END AS is_mine
     FROM template_listings l JOIN users u ON u.id = l.user_id
     WHERE ${conds.join(" AND ")}
     ORDER BY ${sort} LIMIT 60`, params)).rows;
  return { listings: rows.map(shape) };
});

// ---------------------------------------------------------------------------
// templates.getListing — detail page payload
// ---------------------------------------------------------------------------
export const getListingDetail = makeAuthFn("templates.getListing", async (args, userId, pool) => {
  const d = args?.data || {};
  const listing = (await pool.query(
    `SELECT l.*, u.name AS author_name, t.name AS template_name,
       COALESCE((SELECT AVG(tr.rating) FROM template_ratings tr WHERE tr.listing_id = l.id), 0) AS avg_rating,
       (SELECT COUNT(*) FROM template_ratings tr2 WHERE tr2.listing_id = l.id) AS rating_count
     FROM template_listings l JOIN users u ON u.id = l.user_id JOIN templates t ON t.id = l.template_id
     WHERE l.id = $1`, [d.id])).rows[0];
  if (!listing) throw new Error("Listing not found");

  const items = (await pool.query("SELECT * FROM template_line_items WHERE template_id=$1 ORDER BY sort_order", [listing.template_id])).rows.map((r: any) => ({
    id: r.id, description: r.description, quantity: r.quantity, unit: r.unit, unitCost: r.unit_cost, markupPercent: r.markup_percent,
  }));
  const ratings = (await pool.query(
    "SELECT tr.rating, tr.review, tr.created_at, u.name AS user_name FROM template_ratings tr JOIN users u ON u.id = tr.user_id WHERE tr.listing_id = $1 ORDER BY tr.created_at DESC LIMIT 50", [d.id])).rows.map((r: any) => ({
    rating: r.rating, review: r.review, createdAt: r.created_at, userName: r.user_name,
  }));
  const myRating = (await pool.query("SELECT * FROM template_ratings WHERE listing_id=$1 AND user_id=$2", [d.id, userId])).rows[0] || null;
  const installed = !!(await pool.query("SELECT 1 FROM template_installs WHERE listing_id=$1 AND user_id=$2 AND status='installed'", [d.id, userId])).rows[0];
  const purchased = !!(await pool.query("SELECT 1 FROM template_installs WHERE listing_id=$1 AND user_id=$2 AND status='paid'", [d.id, userId])).rows[0];

  return {
    listing: {
      ...shape(listing), templateName: listing.template_name, description: listing.description,
      items, ratings, myRating: myRating ? { rating: myRating.rating, review: myRating.review } : null,
      installed, purchased, isMine: listing.user_id === userId,
    },
  };
});

// ---------------------------------------------------------------------------
// templates.checkout — one-time payment for a paid listing (Stripe payment link)
// ---------------------------------------------------------------------------
export const checkoutListing = makeAuthFn("templates.checkout", async (args, userId, pool) => {
  const d = args?.data || {};
  const listing = (await pool.query("SELECT * FROM template_listings WHERE id=$1 AND is_published=1", [d.listingId])).rows[0];
  if (!listing) throw new Error("Listing not found");
  if (num(listing.price_cents) === 0) return { free: true };

  // Already paid?
  const paid = (await pool.query("SELECT 1 FROM template_installs WHERE listing_id=$1 AND user_id=$2 AND status='paid'", [d.listingId, userId])).rows[0];
  if (paid) return { purchased: true };

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const appUrl = process.env.APP_URL || "https://buildbid.pro";
  const successUrl = `${appUrl}/templates/marketplace?paid=1&listing=${encodeURIComponent(listing.id)}`;

  if (!stripeKey) {
    // Dev fallback (no Stripe configured): mark as paid so the flow is testable.
    const dup = (await pool.query("SELECT 1 FROM template_installs WHERE listing_id=$1 AND user_id=$2 AND status='paid'", [d.listingId, userId])).rows[0];
    if (!dup) await pool.query("INSERT INTO template_installs (id, listing_id, user_id, status) VALUES ($1,$2,$3,'paid')", [crypto.randomUUID(), d.listingId, userId]);
    return { devMode: true, purchased: true };
  }

  const amountCents = Math.round(num(listing.price_cents));
  const resp = await fetch("https://api.stripe.com/v1/payment_links", {
    method: "POST",
    headers: { Authorization: "Bearer " + stripeKey, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": listing.title || "Template",
      "line_items[0][price_data][unit_amount]": String(amountCents),
      "line_items[0][quantity]": "1",
      "after_completion[type]": "redirect",
      "after_completion[redirect][url]": successUrl,
      "metadata[listing_id]": listing.id,
      "metadata[user_id]": userId,
    }),
  });
  const json = await resp.json() as any;
  if (!resp.ok) throw new Error(json.error?.message || "Stripe error");
  return { url: json.url };
});

// ---------------------------------------------------------------------------
// templates.install — clone a listing's template into the user's account
// ---------------------------------------------------------------------------
export const installListing = makeAuthFn("templates.install", async (args, userId, pool) => {
  const d = args?.data || {};
  const listing = (await pool.query("SELECT * FROM template_listings WHERE id=$1 AND is_published=1", [d.listingId])).rows[0];
  if (!listing) throw new Error("Listing not found");

  const installedRow = (await pool.query("SELECT 1 FROM template_installs WHERE listing_id=$1 AND user_id=$2 AND status='installed'", [d.listingId, userId])).rows[0];
  if (installedRow) return { alreadyInstalled: true };

  if (num(listing.price_cents) > 0) {
    const paidRow = (await pool.query("SELECT 1 FROM template_installs WHERE listing_id=$1 AND user_id=$2 AND status='paid'", [d.listingId, userId])).rows[0];
    if (!paidRow) return { requiresPayment: true };
  }

  const newTemplateId = crypto.randomUUID();
  await pool.query("INSERT INTO templates (id, name, trade_type, description, user_id) VALUES ($1,$2,$3,$4,$5)",
    [newTemplateId, listing.title, listing.trade, listing.description, userId]);
  const items = (await pool.query("SELECT * FROM template_line_items WHERE template_id=$1 ORDER BY sort_order", [listing.template_id])).rows;
  for (const it of items) {
    await pool.query(
      "INSERT INTO template_line_items (id, template_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [crypto.randomUUID(), newTemplateId, it.description, it.quantity, it.unit, it.unit_cost, it.markup_percent, it.sort_order]);
  }
  await pool.query("INSERT INTO template_installs (id, listing_id, user_id, status) VALUES ($1,$2,$3,'installed')", [crypto.randomUUID(), d.listingId, userId]);
  await pool.query("UPDATE template_listings SET downloads = downloads + 1 WHERE id=$1", [d.listingId]);
  return { installed: true, templateId: newTemplateId };
});

// ---------------------------------------------------------------------------
// templates.rate — star rating + review (one per user per listing)
// ---------------------------------------------------------------------------
export const rateListing = makeAuthFn("templates.rate", async (args, userId, pool) => {
  const d = args?.data || {};
  const rating = parseInt(d.rating, 10);
  if (!rating || rating < 1 || rating > 5) throw new Error("Rating must be 1–5 stars");
  const review = String(d.review || "").trim().slice(0, 1000);
  const listing = (await pool.query("SELECT id FROM template_listings WHERE id=$1", [d.listingId])).rows[0];
  if (!listing) throw new Error("Listing not found");

  const mine = (await pool.query("SELECT id FROM template_ratings WHERE listing_id=$1 AND user_id=$2", [d.listingId, userId])).rows[0];
  if (mine) {
    await pool.query("UPDATE template_ratings SET rating=$1, review=$2 WHERE id=$3", [rating, review, mine.id]);
  } else {
    await pool.query("INSERT INTO template_ratings (id, listing_id, user_id, rating, review) VALUES ($1,$2,$3,$4,$5)",
      [crypto.randomUUID(), d.listingId, userId, rating, review]);
  }
  const agg = (await pool.query("SELECT COALESCE(AVG(rating),0)::float AS avg_rating, COUNT(*)::int AS rating_count FROM template_ratings WHERE listing_id=$1", [d.listingId])).rows[0];
  return { avgRating: round2(num(agg.avg_rating)), ratingCount: agg.rating_count };
});
