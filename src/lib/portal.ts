import type { Pool } from "@neondatabase/serverless";
import { makeAuthFn, makePublicFn } from "./iso";

// ─── Schema auto-migration ─────────────────────────────────────────
let migrated = false;
async function ensureTables(pool: Pool) {
  if (migrated) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portal_tokens (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      customer_email TEXT DEFAULT '',
      expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON portal_tokens(token)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_portal_tokens_estimate ON portal_tokens(estimate_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS portal_responses (
      id TEXT PRIMARY KEY,
      token_id TEXT NOT NULL REFERENCES portal_tokens(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
      message TEXT DEFAULT '',
      signature_data TEXT DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_portal_responses_token ON portal_responses(token_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS portal_attachments (
      id TEXT PRIMARY KEY,
      token_id TEXT NOT NULL REFERENCES portal_tokens(id) ON DELETE CASCADE,
      filename TEXT NOT NULL DEFAULT 'photo.jpg',
      data_url TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_portal_attachments_token ON portal_attachments(token_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS portal_comments (
      id TEXT PRIMARY KEY,
      token_id TEXT NOT NULL REFERENCES portal_tokens(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL DEFAULT 'Customer',
      message TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_portal_comments_token ON portal_comments(token_id)`);

  migrated = true;
}

// ─── portal.generateToken (auth'd) ─────────────────────────────────
export const generatePortalToken = makeAuthFn("portal.generateToken", async (
  args: { data: { estimateId: string; customerEmail?: string } },
  userId: string,
  pool: Pool
) => {
  await ensureTables(pool);
  const est = await pool.query("SELECT id FROM estimates WHERE id = $1 AND user_id = $2", [args.data.estimateId, userId]);
  if (!est.rows[0]) throw new Error("Estimate not found");

  const id = crypto.randomUUID();
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const email = args.data.customerEmail || "";
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await pool.query(
    `INSERT INTO portal_tokens (id, estimate_id, user_id, token, customer_email, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [id, args.data.estimateId, userId, token, email, expiresAt]
  );
  return { id, token, url: `/portal/${token}`, expiresAt };
});

// ─── portal.getByToken (public) ────────────────────────────────────
export const getPortalByToken = makePublicFn("portal.getByToken", async (
  args: { data: { token: string } },
  pool: Pool
) => {
  await ensureTables(pool);
  const tr = await pool.query(
    `SELECT pt.id, pt.estimate_id, pt.token, pt.customer_email, pt.expires_at,
            e.project_name, e.customer_name, e.trade, e.status, e.notes,
            e.actual_material_cost, e.actual_labor_cost, e.actual_other_cost,
            e.start_date, e.end_date, e.created_at, e.updated_at,
            u.id as user_id
     FROM portal_tokens pt
     JOIN estimates e ON e.id = pt.estimate_id
     JOIN users u ON u.id = pt.user_id
     WHERE pt.token = $1`,
    [args.data.token]
  );
  if (!tr.rows[0]) throw new Error("Invalid or expired portal link");
  const pt = tr.rows[0];
  if (pt.expires_at && new Date(pt.expires_at) < new Date()) {
    throw new Error("This portal link has expired");
  }

  const items = await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [pt.estimate_id]);
  const branding = await pool.query(
    "SELECT company_name, logo_url, primary_color, accent_color, white_label FROM branding WHERE user_id = $1",
    [pt.user_id]
  );
  const responses = await pool.query("SELECT id, status, message, signature_data, created_at FROM portal_responses WHERE token_id = $1 ORDER BY created_at DESC", [pt.id]);
  const attachments = await pool.query("SELECT id, filename, size_bytes, created_at FROM portal_attachments WHERE token_id = $1 ORDER BY created_at DESC", [pt.id]);
  const comments = await pool.query("SELECT id, author_name, message, created_at FROM portal_comments WHERE token_id = $1 ORDER BY created_at ASC", [pt.id]);

  return {
    portal: { token: pt.token, customerEmail: pt.customer_email, expiresAt: String(pt.expires_at || "") },
    estimate: {
      id: pt.estimate_id, projectName: pt.project_name, customerName: pt.customer_name,
      trade: pt.trade, status: pt.status, notes: pt.notes || "",
      actualMaterialCost: pt.actual_material_cost, actualLaborCost: pt.actual_labor_cost,
      actualOtherCost: pt.actual_other_cost, startDate: String(pt.start_date || ""),
      endDate: String(pt.end_date || ""), createdAt: String(pt.created_at || ""), updatedAt: String(pt.updated_at || ""),
    },
    lineItems: (items.rows || []).map((li: any) => ({
      id: li.id, description: li.description, quantity: Number(li.quantity),
      unit: li.unit, unitCost: Number(li.unit_cost), markupPercent: Number(li.markup_percent),
    })),
    branding: branding.rows[0] ? {
      companyName: branding.rows[0].company_name, logoUrl: branding.rows[0].logo_url,
      primaryColor: branding.rows[0].primary_color, accentColor: branding.rows[0].accent_color,
      whiteLabel: !!branding.rows[0].white_label,
    } : null,
    responses: (responses.rows || []).map((r: any) => ({
      id: r.id, status: r.status, message: r.message || "",
      signatureData: r.signature_data || "", createdAt: String(r.created_at || ""),
    })),
    attachments: (attachments.rows || []).map((a: any) => ({
      id: a.id, filename: a.filename, sizeBytes: Number(a.size_bytes), createdAt: String(a.created_at || ""),
    })),
    comments: (comments.rows || []).map((c: any) => ({
      id: c.id, authorName: c.author_name, message: c.message, createdAt: String(c.created_at || ""),
    })),
  };
});

// ─── portal.submitResponse (public) ────────────────────────────────
export const submitPortalResponse = makePublicFn("portal.submitResponse", async (
  args: { data: { token: string; status: string; message?: string; signatureData?: string } },
  pool: Pool
) => {
  await ensureTables(pool);
  const tr = await pool.query("SELECT id, user_id FROM portal_tokens WHERE token = $1", [args.data.token]);
  if (!tr.rows[0]) throw new Error("Invalid portal link");
  const tokenId = tr.rows[0].id;
  const userId = tr.rows[0].user_id;
  const status = args.data.status === "approved" ? "approved" : "rejected";

  const existing = await pool.query("SELECT id FROM portal_responses WHERE token_id = $1", [tokenId]);
  if (existing.rows.length > 0) throw new Error("You have already responded to this estimate");

  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO portal_responses (id, token_id, status, message, signature_data, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [id, tokenId, status, args.data.message || "", args.data.signatureData || ""]
  );
  await pool.query("UPDATE estimates SET status = $1, updated_at = NOW() WHERE id = (SELECT estimate_id FROM portal_tokens WHERE token = $2)",
    [status === "approved" ? "won" : "lost", args.data.token]);

  // Queue email notification
  const userR = await pool.query("SELECT email FROM users WHERE id = $1", [userId]);
  if (userR.rows[0]) {
    try {
      await pool.query(
        `INSERT INTO email_queue (id, to_email, subject, body, sent, created_at)
         VALUES ($1, $2, $3, $4, 0, NOW())`,
        [crypto.randomUUID(), userR.rows[0].email,
         `Estimate ${status === "approved" ? "Approved" : "Rejected"} — ${status === "approved" ? "🎉" : "📋"}`,
         `Your estimate has been ${status} by the customer.\n\n${args.data.message ? `Message: ${args.data.message}\n\n` : ""}View details in your BuildBid dashboard.`]
      );
    } catch (_) {}
  }
  return { success: true, id, status };
});

// ─── portal.addComment (public) ────────────────────────────────────
export const addPortalComment = makePublicFn("portal.addComment", async (
  args: { data: { token: string; authorName: string; message: string } },
  pool: Pool
) => {
  await ensureTables(pool);
  const tr = await pool.query("SELECT id FROM portal_tokens WHERE token = $1", [args.data.token]);
  if (!tr.rows[0]) throw new Error("Invalid portal link");
  if (!args.data.message || !args.data.message.trim()) throw new Error("Message is required");
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO portal_comments (id, token_id, author_name, message, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [id, tr.rows[0].id, args.data.authorName || "Customer", args.data.message.trim()]
  );
  return { success: true, id };
});

// ─── portal.uploadAttachment (public) ──────────────────────────────
export const uploadPortalAttachment = makePublicFn("portal.uploadAttachment", async (
  args: { data: { token: string; filename: string; dataUrl: string; sizeBytes: number } },
  pool: Pool
) => {
  await ensureTables(pool);
  const tr = await pool.query("SELECT id FROM portal_tokens WHERE token = $1", [args.data.token]);
  if (!tr.rows[0]) throw new Error("Invalid portal link");
  if (args.data.sizeBytes > 5 * 1024 * 1024) throw new Error("File exceeds 5MB limit");
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO portal_attachments (id, token_id, filename, data_url, size_bytes, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [id, tr.rows[0].id, args.data.filename || "photo.jpg", args.data.dataUrl, args.data.sizeBytes]
  );
  return { success: true, id };
});

// ─── portal.revokeToken (auth'd) ───────────────────────────────────
export const revokePortalToken = makeAuthFn("portal.revokeToken", async (
  args: { data: { tokenId: string } }, userId: string, pool: Pool
) => {
  await ensureTables(pool);
  await pool.query("DELETE FROM portal_tokens WHERE id = $1 AND user_id = $2", [args.data.tokenId, userId]);
  return { success: true };
});
