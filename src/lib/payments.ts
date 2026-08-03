import { makeAuthFn, makeAuthFnFull } from "./iso";

export const createPaymentLink = makeAuthFnFull("payments.createPaymentLink", async (args: { data: { invoiceId: string; amount: number; description: string } }, user, pool) => {
  const amountCents = Math.round(args.data.amount * 100);
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error("Stripe not configured");
  const resp = await fetch("https://api.stripe.com/v1/payment_links", { method: "POST", headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ "line_items[0][price_data][currency]": "usd", "line_items[0][price_data][product_data][name]": args.data.description, "line_items[0][price_data][unit_amount]": String(amountCents), "line_items[0][quantity]": "1", "after_completion[type]": "redirect", "after_completion[redirect][url]": `${process.env.APP_URL || "https://site-delta-seven-64.vercel.app"}/api/payment-confirm?invoice_id=${args.data.invoiceId}`, "metadata[invoice_id]": args.data.invoiceId, "metadata[user_id]": user.id }) });
  const json = await resp.json() as any;
  if (!resp.ok) throw new Error(json.error?.message || "Stripe error");
  await pool.query("UPDATE invoices SET pdf_data = CASE WHEN pdf_data IS NULL OR pdf_data = '' THEN $1 ELSE pdf_data END WHERE id = $2", [json.id, args.data.invoiceId]);
  return { url: json.url, id: json.id };
});

export const createDepositLink = makeAuthFnFull("payments.createDepositLink", async (args: { data: { estimateId: string; amount: number; description: string } }, user, _pool) => {
  const amountCents = Math.round(args.data.amount * 100);
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error("Stripe not configured");
  const resp = await fetch("https://api.stripe.com/v1/payment_links", { method: "POST", headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ "line_items[0][price_data][currency]": "usd", "line_items[0][price_data][product_data][name]": args.data.description, "line_items[0][price_data][unit_amount]": String(amountCents), "line_items[0][quantity]": "1", "after_completion[type]": "redirect", "after_completion[redirect][url]": `${process.env.APP_URL || "https://site-delta-seven-64.vercel.app"}/api/payment-confirm?estimate_id=${args.data.estimateId}&type=deposit`, "metadata[estimate_id]": args.data.estimateId, "metadata[type]": "deposit", "metadata[user_id]": user.id }) });
  const json = await resp.json() as any;
  if (!resp.ok) throw new Error(json.error?.message || "Stripe error");
  return { url: json.url, id: json.id };
});

export const checkPaymentStatus = makeAuthFn("payments.checkPaymentStatus", async (args: { data: { invoiceId: string } }, _userId, pool) => {
  const invR = await pool.query("SELECT status, paid_at FROM invoices WHERE id = $1", [args.data.invoiceId]);
  return { paid: invR.rows[0]?.status === "paid", paidAt: invR.rows[0]?.paid_at || null };
});
