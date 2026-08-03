import { createServerFn } from "@tanstack/react-start";

export const handlePaymentConfirmation = createServerFn({ method: "GET" })
  .handler(async ({ data: rawData }) => {
    const url = new URL(rawData?.toString() || "");
    const invoiceId = url.searchParams.get("invoice_id");
    const estimateId = url.searchParams.get("estimate_id");
    
    const mod = await import("../lib/db.server");
    const db = await mod.getDb();
    
    if (invoiceId) {
      db.run("UPDATE invoices SET status = 'paid', paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
        [invoiceId]);
    }
    
    if (estimateId) {
      db.run("UPDATE estimates SET status = 'won', updated_at = datetime('now') WHERE id = ? AND status NOT IN ('won','submitted')",
        [estimateId]);
    }
    
    // Redirect to a success page
    return new Response(null, {
      status: 302,
      headers: { Location: "/payment-success" },
    });
  });
