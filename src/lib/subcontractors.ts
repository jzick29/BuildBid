import { makeAuthFn } from "./iso";

// ─── listRfqs ─────────────────────────────────────────────────────
export const listRfqs = makeAuthFn("rfqs.list", async (_args: any, userId: string, pool: any) => {
  const r = await pool.query(
    `SELECT r.*, e.project_name as estimate_name,
            COUNT(q.id) as quote_count,
            MIN(q.amount) as lowest_quote
     FROM rfqs r
     LEFT JOIN estimates e ON e.id = r.estimate_id
     LEFT JOIN rfq_quotes q ON q.rfq_id = r.id
     WHERE r.user_id = $1
     GROUP BY r.id, e.project_name
     ORDER BY r.created_at DESC`,
    [userId]
  );
  return { rfqs: r.rows };
});

// ─── getRfq ────────────────────────────────────────────────────────
export const getRfq = makeAuthFn("rfqs.get", async (args: { data: { rfqId: string } }, userId: string, pool: any) => {
  const r = await pool.query("SELECT * FROM rfqs WHERE id = $1 AND user_id = $2", [args.data.rfqId, userId]);
  if (!r.rows[0]) throw new Error("RFQ not found");
  const quotes = await pool.query(
    "SELECT * FROM rfq_quotes WHERE rfq_id = $1 ORDER BY amount ASC, received_at ASC",
    [args.data.rfqId]
  );
  let estimate: any = null;
  if (r.rows[0].estimate_id) {
    const er = await pool.query(
      `SELECT e.id, e.project_name, e.customer_name, COALESCE(SUM(li.quantity * li.unit_cost * (1 + li.markup_percent / 100)), 0) as total
       FROM estimates e LEFT JOIN line_items li ON li.estimate_id = e.id
       WHERE e.id = $1 GROUP BY e.id`,
      [r.rows[0].estimate_id]
    );
    estimate = er.rows[0] || null;
  }
  return { rfq: r.rows[0], quotes: quotes.rows, estimate };
});

// ─── createRfq ─────────────────────────────────────────────────────
export const createRfq = makeAuthFn(
  "rfqs.create",
  async (args: { data: { title: string; estimateId?: string; scope?: string; dueDate?: string } }, userId: string, pool: any) => {
    const d = args.data || {};
    if (!d.title || !String(d.title).trim()) throw new Error("Title is required");
    const id = crypto.randomUUID();
    if (d.estimateId) {
      const est = await pool.query("SELECT id FROM estimates WHERE id = $1 AND user_id = $2", [d.estimateId, userId]);
      if (!est.rows[0]) throw new Error("Estimate not found");
    }
    await pool.query(
      "INSERT INTO rfqs (id, user_id, title, estimate_id, scope, due_date) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, userId, String(d.title).trim(), d.estimateId || null, d.scope || "", d.dueDate || ""]
    );
    return { success: true, id };
  }
);

// ─── updateRfqStatus ───────────────────────────────────────────────
export const updateRfqStatus = makeAuthFn(
  "rfqs.updateStatus",
  async (args: { data: { rfqId: string; status: string } }, userId: string, pool: any) => {
    const d = args.data || {};
    const allowed = ["open", "sent", "awarded", "closed"];
    if (!allowed.includes(d.status)) throw new Error("Invalid status");
    const r = await pool.query("UPDATE rfqs SET status = $1 WHERE id = $2 AND user_id = $3", [d.status, d.rfqId, userId]);
    if (r.rowCount === 0) throw new Error("RFQ not found");
    return { success: true };
  }
);

// ─── addQuote ──────────────────────────────────────────────────────
export const addQuote = makeAuthFn(
  "rfqs.addQuote",
  async (
    args: { data: { rfqId: string; subcontractor: string; contact?: string; email?: string; phone?: string; amount: number; timeline?: string; notes?: string } },
    userId: string,
    pool: any
  ) => {
    const d = args.data || {};
    if (!d.rfqId || !d.subcontractor || !String(d.subcontractor).trim()) throw new Error("Subcontractor name is required");
    if (Number(d.amount) <= 0 || !Number.isFinite(Number(d.amount))) throw new Error("Valid quote amount is required");
    const own = await pool.query("SELECT id FROM rfqs WHERE id = $1 AND user_id = $2", [d.rfqId, userId]);
    if (!own.rows[0]) throw new Error("RFQ not found");
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO rfq_quotes (id, rfq_id, subcontractor, contact, email, phone, amount, timeline, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, d.rfqId, String(d.subcontractor).trim(), d.contact || "", d.email || "", d.phone || "", Number(d.amount), d.timeline || "", d.notes || ""]
    );
    return { success: true, id };
  }
);

// ─── updateQuoteStatus ─────────────────────────────────────────────
export const updateQuoteStatus = makeAuthFn(
  "rfqs.updateQuoteStatus",
  async (args: { data: { quoteId: string; status: string } }, userId: string, pool: any) => {
    const d = args.data || {};
    const allowed = ["pending", "selected", "declined"];
    if (!allowed.includes(d.status)) throw new Error("Invalid status");
    const r = await pool.query(
      `UPDATE rfq_quotes SET status = $1
       WHERE id = $2 AND rfq_id IN (SELECT id FROM rfqs WHERE user_id = $3)`,
      [d.status, d.quoteId, userId]
    );
    if (r.rowCount === 0) throw new Error("Quote not found");
    if (d.status === "selected") {
      await pool.query(
        `UPDATE rfqs SET status = 'awarded' WHERE id = (SELECT rfq_id FROM rfq_quotes WHERE id = $1) AND user_id = $2`,
        [d.quoteId, userId]
      );
    }
    return { success: true };
  }
);

// ─── deleteQuote ───────────────────────────────────────────────────
export const deleteQuote = makeAuthFn("rfqs.deleteQuote", async (args: { data: { quoteId: string } }, userId: string, pool: any) => {
  const r = await pool.query(
    "DELETE FROM rfq_quotes WHERE id = $1 AND rfq_id IN (SELECT id FROM rfqs WHERE user_id = $2)",
    [args.data.quoteId, userId]
  );
  if (r.rowCount === 0) throw new Error("Quote not found");
  return { success: true };
});

// ─── compare ───────────────────────────────────────────────────────
export const compareQuotes = makeAuthFn("rfqs.compare", async (args: { data: { rfqId: string } }, userId: string, pool: any) => {
  const r = await pool.query("SELECT * FROM rfqs WHERE id = $1 AND user_id = $2", [args.data.rfqId, userId]);
  if (!r.rows[0]) throw new Error("RFQ not found");
  const rfq = r.rows[0];
  const quotes = await pool.query(
    "SELECT * FROM rfq_quotes WHERE rfq_id = $1 ORDER BY amount ASC",
    [args.data.rfqId]
  );
  let estimateTotal: number | null = null;
  if (rfq.estimate_id) {
    const er = await pool.query(
      "SELECT COALESCE(SUM(quantity * unit_cost * (1 + markup_percent / 100)), 0) as total FROM line_items WHERE estimate_id = $1",
      [rfq.estimate_id]
    );
    estimateTotal = Number(er.rows[0].total);
  }
  const best = quotes.rows[0] || null;
  const rows = quotes.rows.map((q: any) => {
    const amount = Number(q.amount);
    return {
      ...q,
      amount,
      savingsVsBest: best ? Math.round((amount - Number(best.amount)) * 100) / 100 : 0,
      savingsVsEstimate: estimateTotal !== null ? Math.round((estimateTotal - amount) * 100) / 100 : null,
      pctVsEstimate: estimateTotal ? Math.round((amount / estimateTotal) * 1000) / 10 : null,
    };
  });
  return { rfq, rows, estimateTotal, best: best ? { id: best.id, subcontractor: best.subcontractor, amount: Number(best.amount) } : null };
});
