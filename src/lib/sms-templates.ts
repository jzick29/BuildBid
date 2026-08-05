// SMS templates for BuildBid — customer-facing text messages.
// Isomorphic module (no Node deps) so templates can render on client or server.
// Variables: {businessName} {projectName} {amount} {link} {date} {time} {address} {invoiceId} {customerName}

export interface SmsTemplateDef {
  label: string;
  description: string;
  template: string;
  example: string;
}

export const SMS_TEMPLATES: Record<string, SmsTemplateDef> = {
  proposal_ready: {
    label: "Proposal Ready",
    description: "Sent when a proposal/estimate is marked as sent",
    template: "{businessName}: Your estimate for {projectName} is ready. View & sign: {link}",
    example: "Acme Electric: Your estimate for Kitchen Rewire is ready. View & sign: https://buildbid.pro/share/abc123",
  },
  invoice_due: {
    label: "Invoice Due Reminder",
    description: "Sent when an invoice is due or a reminder is triggered",
    template: "Reminder: Invoice #{invoiceId} for {amount} is due on {date}. Pay online: {link}",
    example: "Reminder: Invoice #1042 for $2,450.00 is due on Aug 20, 2026. Pay online: https://buildbid.pro/invoices/xyz789",
  },
  appointment_scheduled: {
    label: "Appointment Scheduled",
    description: "Sent when a job or visit is scheduled",
    template: "{businessName} will be at {address} on {date} at {time}",
    example: "Acme Electric will be at 123 Main St on Aug 25, 2026 at 8:00 AM",
  },
  estimate_won: {
    label: "Estimate Won",
    description: "Sent when a proposal is accepted",
    template: "Great news! Your proposal has been accepted. We'll begin work on {date}",
    example: "Great news! Your proposal has been accepted. We'll begin work on Aug 25, 2026",
  },
  payment_received: {
    label: "Payment Received",
    description: "Sent when a payment is received",
    template: "Payment of {amount} received. Thank you!",
    example: "Payment of $2,450.00 received. Thank you!",
  },
  test: {
    label: "Test Message",
    description: "A test message sent from Settings",
    template: "This is a test message from {businessName}. SMS notifications are working!",
    example: "This is a test message from Acme Electric. SMS notifications are working!",
  },
};

export type SmsTemplateType = keyof typeof SMS_TEMPLATES;

export const SMS_TEMPLATE_KEYS = Object.keys(SMS_TEMPLATES);

const MAX_SMS_LENGTH = 160;

/** Fill template placeholders with variables. Unknown placeholders are left as-is. */
export function renderSmsTemplate(type: string, vars: Record<string, string | number> = {}): string {
  const tpl = SMS_TEMPLATES[type]?.template || "";
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) =>
    vars[k] !== undefined && vars[k] !== null && vars[k] !== "" ? String(vars[k]) : m
  );
}

/** Normalize a phone number to E.164 (+1XXXXXXXXXX for US 10-digit). Returns "" if invalid. */
export function normalizePhone(raw: string | number | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  let digits = s.replace(/\D/g, "");
  if (s.startsWith("+")) digits = "+" + digits.replace(/^\+/, "");
  if (digits.startsWith("+")) {
    const d = digits.slice(1);
    if (d.length === 11 && d.startsWith("1")) return "+" + d;
    if (d.length >= 10 && d.length <= 15) return "+" + d;
    return "";
  }
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return "";
}

/**
 * Truncate an SMS to 160 chars, preferring to keep any URL intact
 * (trim leading text before the link rather than cutting the link itself).
 */
export function truncateSms(message: string): { text: string; truncated: boolean } {
  if (message.length <= MAX_SMS_LENGTH) return { text: message, truncated: false };
  const urls = message.match(/https?:\/\/\S+/g);
  if (urls && urls.length > 0) {
    const url = urls[urls.length - 1];
    const idx = message.lastIndexOf(url);
    if (idx > 0 && url.length <= MAX_SMS_LENGTH - 4) {
      const headBudget = MAX_SMS_LENGTH - url.length - 3;
      const head = message.slice(0, idx).trimEnd();
      const trimmedHead = head.length > headBudget ? head.slice(head.length - headBudget) : head;
      return { text: trimmedHead + "..." + url, truncated: true };
    }
  }
  return { text: message.slice(0, MAX_SMS_LENGTH - 3) + "...", truncated: true };
}

/** Shorten a link for display in the settings preview (host + tail of path). */
export function shortenLink(url: string, maxLen = 42): string {
  if (url.length <= maxLen) return url;
  try {
    const u = new URL(url);
    const host = u.host;
    const budget = Math.max(12, maxLen - host.length - 2);
    const tail = u.pathname + u.search;
    return `${host}/…${tail.slice(-budget)}`;
  } catch {
    return url.slice(0, maxLen) + "…";
  }
}
