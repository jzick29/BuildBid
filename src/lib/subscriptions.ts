import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { getCookie, deleteCookie } from "@tanstack/react-start/server";

async function requireUser() {
  const db = await (await import("./db.server")).getDb();
  const token = getCookie("buildbid_session");
  if (!token) throw redirect({ to: "/login" });
  const row = db.query(
    "SELECT u.id, u.email, u.name, u.plan, u.stripe_customer_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > datetime('now')"
  ).get(token) as any;
  if (!row) {
    deleteCookie("buildbid_session", { path: "/" });
    throw redirect({ to: "/login" });
  }
  return row;
}

const STRIPE_LINKS: Record<string, string> = {
  starter: "https://buy.stripe.com/dRmaEZ7ej5np8B8g5t57W0o",
  pro: "https://buy.stripe.com/8x29AVgOT4jl04C5qP57W0o",
  shop: "https://buy.stripe.com/7sYcN7fKPg23cRo8D157W0q",
};

const PLAN_PRICES: Record<string, { monthly: number; annual: number }> = {
  starter: { monthly: 49, annual: 39 },
  pro: { monthly: 99, annual: 79 },
  shop: { monthly: 199, annual: 159 },
};

export function getStripeLink(plan: string): string {
  return STRIPE_LINKS[plan] || STRIPE_LINKS.starter;
}

export function getPlanPrices(plan: string) {
  return PLAN_PRICES[plan] || PLAN_PRICES.starter;
}

export const getSubscriptionStatus = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  return {
    plan: user.plan,
    stripeCustomerId: user.stripe_customer_id,
  };
});

export const activateSubscription = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const v = d as { plan: string; stripeCustomerId?: string };
    if (!["starter", "pro", "shop"].includes(v.plan)) throw new Error("Invalid plan");
    return v;
  })
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (user.plan !== "free") throw new Error("Already subscribed");
    const db = await (await import("./db.server")).getDb();
    db.run("UPDATE users SET plan = ?, stripe_customer_id = COALESCE(?, stripe_customer_id) WHERE id = ?",
      [data.plan, data.stripeCustomerId || null, user.id]);
    return { success: true, plan: data.plan };
  });

export const cancelSubscription = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireUser();
  const db = await (await import("./db.server")).getDb();
  db.run("UPDATE users SET plan = 'free' WHERE id = ?", [user.id]);
  return { success: true };
});