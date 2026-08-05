import { createServerFn } from "@tanstack/react-start";

// Email server functions — use fetch to call the inbox API
// The inbox is buildbid-c6f133ab@ctomail.io

const INBOX_ID = "buildbid-c6f133ab@ctomail.io";
const SITE_URL = process.env.SITE_URL || "https://9577f8f2426f13c1d9bbbec4a82baaa4.ctonew.app";

// Helper to send email via the inbox API
async function sendEmailApi(to: string, subject: string, body: string) {
  // Use fetch to call the email API endpoint
  const response = await fetch(`${SITE_URL}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, subject, body }),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error("Email send failed:", text);
    return { success: false, error: text };
  }
  return { success: true };
}

export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const data = d as { email: string; name: string };
    if (!data.email) throw new Error("Email is required");
    return data;
  })
  .handler(async ({ data }) => {
    const subject = "Welcome to BuildBid!";
    const body = `Hi ${data.name},

Welcome to BuildBid! You're ready to start estimating.

Get started by creating your first estimate:
${SITE_URL}/dashboard

Need help? Just reply to this email.

— The BuildBid Team`;
    return sendEmailApi(data.email, subject, body);
  });

export const sendPasswordResetEmail = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const data = d as { email: string; resetLink: string };
    if (!data.email || !data.resetLink) throw new Error("Email and reset link are required");
    return data;
  })
  .handler(async ({ data }) => {
    const subject = "Reset your BuildBid password";
    const body = `Hi,

We received a request to reset your BuildBid password.

Click the link below to set a new password:
${data.resetLink}

This link expires in 1 hour.

If you didn't request this, you can safely ignore this email.

— The BuildBid Team`;
    return sendEmailApi(data.email, subject, body);
  });