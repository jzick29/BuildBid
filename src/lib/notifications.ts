// Transactional email/SMS notification system for BuildBid
// Uses /api/-send-email for email queuing and push.ts for mobile push.
import { makeAuthFn } from "./iso";
import type { Pool } from "@neondatabase/serverless";

const SITE_URL = "https://buildbid.pro";

// ─── HTML Email Layout ──────────────────────────────────────────

function brandHtml(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
<tr><td style="background:#4f46e5;padding:24px 32px">
  <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">BuildBid</h1>
</td></tr>
<tr><td style="padding:32px">
  <h2 style="margin:0 0 16px;color:#111827;font-size:18px;font-weight:600">${title}</h2>
  ${contentHtml}
</td></tr>
<tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
  <p style="margin:0 0 8px;color:#6b7280;font-size:12px">BuildBid &mdash; Estimating software for trade contractors</p>
  <p style="margin:0;color:#9ca3af;font-size:11px">
    <a href="${SITE_URL}/unsubscribe" style="color:#4f46e5">Unsubscribe</a> from BuildBid notifications.
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// ─── Send helpers ───────────────────────────────────────────────

async function queueEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
  try {
    const res = await fetch(`${SITE_URL}/api/-send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body: htmlBody }),
    });
    return res.ok;
  } catch (e) {
    console.error("[notifications] queueEmail failed:", e);
    return false;
  }
}

async function push(userId: string, title: string, body: string, url?: string) {
  try {
    const { sendPushNotification } = await import("./push");
    await sendPushNotification(userId, title, body, url);
  } catch {}
}

async function getUserEmail(pool: Pool, userId: string): Promise<string | null> {
  const r = await pool.query("SELECT email, email_notifications FROM users WHERE id = $1", [userId]);
  const u = r.rows[0];
  if (!u || u.email_notifications === false || u.email_notifications === 0) return null;
  return u.email;
}

// ─── Estimate Status Notifications ──────────────────────────────

export const sendEstimateSentEmail = makeAuthFn("notifications.sendEstimateSentEmail", async (
  args: { data: { estimateId: string; customerEmail: string; projectName: string; customerName: string } },
  userId, pool
) => {
  const { estimateId, customerEmail, projectName, customerName } = args.data;
  const title = `Proposal for ${projectName}`;
  const content = `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Hi ${customerName},</p>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Your proposal for <strong>${projectName}</strong> is ready for review.</p>
<p style="margin:0 0 24px"><a href="${SITE_URL}/share/${estimateId}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">View Your Proposal</a></p>
<p style="margin:0;color:#6b7280;font-size:13px">You can review details and sign digitally &mdash; all online.</p>`;
  await queueEmail(customerEmail, title, brandHtml(title, content));
  await pool.query("INSERT INTO automation_logs (id, user_id, type, estimate_id, recipient) VALUES ($1,$2,$3,$4,$5)",
    [crypto.randomUUID(), userId, "estimate_sent", estimateId, customerEmail]);
  await push(userId, "Proposal Sent", `${projectName} proposal sent to ${customerName}`, `/estimates/${estimateId}`);
  return { success: true };
});

export const sendEstimateWonAlert = makeAuthFn("notifications.sendEstimateWonAlert", async (
  args: { data: { estimateId: string; projectName: string; customerName: string; customerEmail?: string } },
  userId, pool
) => {
  const { estimateId, projectName, customerName, customerEmail } = args.data;
  // Notify contractor
  const userEmail = await getUserEmail(pool, userId);
  if (userEmail) {
    const title = `You won ${projectName}!`;
    const content = `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Congratulations! <strong>${customerName}</strong> accepted your proposal for <strong>${projectName}</strong>.</p>
<p style="margin:0 0 24px"><a href="${SITE_URL}/estimates/${estimateId}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">View Estimate</a></p>`;
    await queueEmail(userEmail, title, brandHtml(title, content));
  }
  // Thank customer
  if (customerEmail) {
    const ct = `Thank you for choosing us — ${projectName}`;
    const cc = `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Hi ${customerName},</p>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Thank you for accepting our proposal for <strong>${projectName}</strong>. We're excited to get started!</p>
<p style="margin:0;color:#6b7280;font-size:13px">We'll be in touch with next steps shortly.</p>`;
    await queueEmail(customerEmail, ct, brandHtml(ct, cc));
  }
  await push(userId, "Estimate Won!", `You won ${projectName} with ${customerName}`, `/estimates/${estimateId}`);
  await pool.query("INSERT INTO automation_logs (id, user_id, type, estimate_id, recipient) VALUES ($1,$2,$3,$4,$5)",
    [crypto.randomUUID(), userId, "estimate_won", estimateId, customerEmail || ""]);
  return { success: true };
});

export const sendEstimateLostAlert = makeAuthFn("notifications.sendEstimateLostAlert", async (
  args: { data: { estimateId: string; projectName: string; customerName: string } },
  userId, pool
) => {
  const { estimateId, projectName, customerName } = args.data;
  const userEmail = await getUserEmail(pool, userId);
  if (userEmail) {
    const title = `Update on ${projectName}`;
    const content = `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Your proposal for <strong>${projectName}</strong> with <strong>${customerName}</strong> wasn't selected this time.</p>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Every loss is data &mdash; review what happened and sharpen your next bid.</p>
<p style="margin:0 0 24px"><a href="${SITE_URL}/estimates/${estimateId}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Review Estimate</a></p>`;
    await queueEmail(userEmail, title, brandHtml(title, content));
  }
  await push(userId, "Estimate Lost", `${projectName} with ${customerName} wasn't selected`, `/estimates/${estimateId}`);
  await pool.query("INSERT INTO automation_logs (id, user_id, type, estimate_id) VALUES ($1,$2,$3,$4)",
    [crypto.randomUUID(), userId, "estimate_lost", estimateId]);
  return { success: true };
});

// ─── Invoice Notifications ──────────────────────────────────────

export const sendInvoiceCreatedEmail = makeAuthFn("notifications.sendInvoiceCreatedEmail", async (
  args: { data: { invoiceId: string; estimateId: string; customerEmail: string; projectName: string;
    customerName: string; total: number; invoiceNumber: number; dueDate: string } },
  userId, pool
) => {
  const { invoiceId, estimateId, customerEmail, projectName, customerName, total, invoiceNumber, dueDate } = args.data;
  const title = `Invoice #${invoiceNumber} for ${projectName}`;
  const content = `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Hi ${customerName},</p>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Your invoice for <strong>${projectName}</strong> is ready.</p>
<table cellpadding="8" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin:0 0 24px;width:100%">
<tr><td style="color:#6b7280;font-size:13px">Invoice</td><td style="color:#111827;font-weight:600;font-size:14px;text-align:right">#${invoiceNumber}</td></tr>
<tr><td style="color:#6b7280;font-size:13px">Amount Due</td><td style="color:#4f46e5;font-weight:700;font-size:16px;text-align:right">$${total.toFixed(2)}</td></tr>
<tr><td style="color:#6b7280;font-size:13px">Due Date</td><td style="color:#111827;font-size:14px;text-align:right">${dueDate}</td></tr>
</table>
<p style="margin:0 0 24px"><a href="${SITE_URL}/invoices/${invoiceId}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">View Invoice</a></p>`;
  await queueEmail(customerEmail, title, brandHtml(title, content));
  await pool.query("INSERT INTO automation_logs (id, user_id, type, estimate_id, recipient) VALUES ($1,$2,$3,$4,$5)",
    [crypto.randomUUID(), userId, "invoice_created", estimateId, customerEmail]);
  await push(userId, "Invoice Created", `Invoice #${invoiceNumber} for ${projectName}`, `/invoices/${invoiceId}`);
  return { success: true };
});

export const sendInvoiceReminderEmail = makeAuthFn("notifications.sendInvoiceReminderEmail", async (
  args: { data: { invoiceId: string; estimateId: string; customerEmail: string; projectName: string;
    customerName: string; total: number; invoiceNumber: number; dueDate: string } },
  userId, pool
) => {
  const { invoiceId, estimateId, customerEmail, projectName, customerName, total, invoiceNumber, dueDate } = args.data;
  const title = `Reminder: Invoice #${invoiceNumber} for ${projectName}`;
  const content = `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Hi ${customerName},</p>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">This is a friendly reminder that your invoice for <strong>${projectName}</strong> is due.</p>
<table cellpadding="8" cellspacing="0" style="background:#fef3c7;border-radius:8px;margin:0 0 24px;width:100%">
<tr><td style="color:#92400e;font-size:13px">Invoice</td><td style="color:#92400e;font-weight:600;font-size:14px;text-align:right">#${invoiceNumber}</td></tr>
<tr><td style="color:#92400e;font-size:13px">Amount Due</td><td style="color:#d97706;font-weight:700;font-size:16px;text-align:right">$${total.toFixed(2)}</td></tr>
<tr><td style="color:#92400e;font-size:13px">Due Date</td><td style="color:#92400e;font-size:14px;text-align:right">${dueDate}</td></tr>
</table>
<p style="margin:0 0 24px"><a href="${SITE_URL}/invoices/${invoiceId}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">View &amp; Pay Invoice</a></p>`;
  await queueEmail(customerEmail, title, brandHtml(title, content));
  await pool.query("INSERT INTO automation_logs (id, user_id, type, estimate_id, recipient) VALUES ($1,$2,$3,$4,$5)",
    [crypto.randomUUID(), userId, "invoice_reminder", estimateId, customerEmail]);
  return { success: true };
});

// ─── Change Order Notifications ─────────────────────────────────

export const sendChangeOrderSentEmail = makeAuthFn("notifications.sendChangeOrderSentEmail", async (
  args: { data: { changeOrderId: string; estimateId: string; customerEmail: string;
    projectName: string; customerName: string; coTitle: string } },
  userId, pool
) => {
  const { changeOrderId, estimateId, customerEmail, projectName, customerName, coTitle } = args.data;
  const title = `Change Order: ${coTitle} — ${projectName}`;
  const content = `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Hi ${customerName},</p>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">A change order for <strong>${projectName}</strong> is ready for your review.</p>
<p style="margin:0 0 24px"><a href="${SITE_URL}/share/${estimateId}?co=${changeOrderId}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Review Change Order</a></p>`;
  await queueEmail(customerEmail, title, brandHtml(title, content));
  await pool.query("INSERT INTO automation_logs (id, user_id, type, estimate_id, recipient) VALUES ($1,$2,$3,$4,$5)",
    [crypto.randomUUID(), userId, "change_order_sent", estimateId, customerEmail]);
  await push(userId, "Change Order Sent", `${coTitle} for ${projectName} was sent`, `/estimates/${estimateId}`);
  return { success: true };
});

export const sendChangeOrderResolvedAlert = makeAuthFn("notifications.sendChangeOrderResolvedAlert", async (
  args: { data: { changeOrderId: string; estimateId: string; projectName: string; coTitle: string; approved: boolean } },
  userId, pool
) => {
  const { estimateId, projectName, coTitle, approved } = args.data;
  const status = approved ? "approved" : "declined";
  await push(userId, `Change Order ${status}`, `"${coTitle}" for ${projectName} was ${status}`, `/estimates/${estimateId}`);
  await pool.query("INSERT INTO automation_logs (id, user_id, type, estimate_id) VALUES ($1,$2,$3,$4)",
    [crypto.randomUUID(), userId, `change_order_${approved ? "approved" : "rejected"}`, estimateId]);
  return { success: true };
});

// ─── Unsubscribe ────────────────────────────────────────────────

export const unsubscribeUser = makeAuthFn("notifications.unsubscribeUser", async (_args: any, userId, pool) => {
  await pool.query("UPDATE users SET email_notifications = false WHERE id = $1", [userId]);
  return { success: true, message: "Unsubscribed from BuildBid notifications." };
});

export const resubscribeUser = makeAuthFn("notifications.resubscribeUser", async (_args: any, userId, pool) => {
  await pool.query("UPDATE users SET email_notifications = true WHERE id = $1", [userId]);
  return { success: true, message: "Resubscribed to BuildBid notifications." };
});
