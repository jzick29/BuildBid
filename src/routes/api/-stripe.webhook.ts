// POST /api/stripe/webhook — handles Stripe webhook events
// Receives checkout.session.completed and marks invoices as paid
// Uses raw crypto (no stripe npm dependency) for webhook verification
import { json } from "@tanstack/react-start";
import crypto from "crypto";

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const sigHeader = request.headers.get("stripe-signature");
  if (!sigHeader) {
    return json({ error: "Missing signature" }, { status: 400 });
  }

  try {
    const body = await request.text();
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeKey || !webhookSecret) {
      console.error("[stripe/webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not set");
      return json({ error: "Stripe not configured" }, { status: 500 });
    }

    // Verify webhook signature manually (no stripe npm package)
    let event: any;
    try {
      const parts = sigHeader.split(",").reduce((acc: Record<string, string>, part: string) => {
        const [k, v] = part.split("=");
        acc[k.trim()] = v.trim();
        return acc;
      }, {});
      const timestamp = parts["t"];
      const signature = parts["v1"];
      if (!timestamp || !signature) throw new Error("Invalid signature format");

      const signedPayload = `${timestamp}.${body}`;
      const expectedSig = crypto
        .createHmac("sha256", webhookSecret)
        .update(signedPayload)
        .digest("hex");

      if (signature !== expectedSig) {
        throw new Error("Signature mismatch");
      }

      event = JSON.parse(body);
    } catch (e: any) {
      console.error("[stripe/webhook] Signature verification failed:", e.message);
      return json({ error: "Invalid signature" }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const invoiceId = session.metadata?.invoice_id;
      const userId = session.metadata?.user_id;

      if (!invoiceId) {
        console.error("[stripe/webhook] No invoice_id in session metadata");
        return json({ received: true });
      }

      const isVercel = typeof process !== 'undefined' && !!process.env.VERCEL;
      if (isVercel) {
        const pool = (globalThis as any).__buildbid_pool;
        if (pool) {
          await pool.query(
            "UPDATE invoices SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = $1",
            [invoiceId]
          );
          const payId = crypto.randomUUID();
          await pool.query(
            `INSERT INTO payments (id, user_id, invoice_id, amount, currency, stripe_session_id, status, created_at)
             VALUES ($1, $2, $3, $4, 'usd', $5, 'completed', NOW())`,
            [payId, userId || '', invoiceId, session.amount_total ? session.amount_total / 100 : 0, session.id]
          );
        }
      } else {
        const mod = await import("~/lib/db.server");
        const db = await mod.getDb();
        db.run("UPDATE invoices SET status = ?, paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
          ["paid", invoiceId]);
        const payId = crypto.randomUUID();
        db.run(
          "INSERT INTO payments (id, user_id, invoice_id, amount, currency, stripe_session_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
          [payId, userId || '', invoiceId, session.amount_total ? session.amount_total / 100 : 0, 'usd', session.id, 'completed']
        );
      }

      console.log(`[stripe/webhook] Invoice ${invoiceId} marked as paid`);
    }

    return json({ received: true });
  } catch (e: any) {
    console.error("[stripe/webhook] Error:", e.message);
    return json({ error: e.message }, { status: 500 });
  }
}

export const POST = action;
