import { createIsomorphicFn } from "@tanstack/react-start";
import { getPool } from "./pool";
import { registerHandler } from "./call-registry";

// ---- getProposalViews ----
async function _getProposalViews(args: { data: { estimateId: string } }) {
  const pool = getPool();
  const result = await pool.query(
    "SELECT COUNT(*) as view_count, MAX(viewed_at) as last_viewed FROM proposal_views WHERE estimate_id = $1",
    [args.data.estimateId]
  );
  const row = result.rows[0];
  return { viewCount: parseInt(row?.view_count || "0"), lastViewed: row?.last_viewed || null };
}
registerHandler("tracking.getProposalViews", _getProposalViews);

export const getProposalViews = createIsomorphicFn()
  .client(async (args: { data: { estimateId: string } }) => {
    const res = await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "tracking.getProposalViews", args }),
      credentials: "include",
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
    return res.json();
  })
  .server(_getProposalViews);

// ---- logProposalView (called by tracking pixel — may be anonymous) ----
async function _logProposalView(args: { data: { estimateId: string } }) {
  const pool = getPool();
  const id = crypto.randomUUID();
  await pool.query(
    "INSERT INTO proposal_views (id, estimate_id, viewed_at) VALUES ($1, $2, NOW())",
    [id, args.data.estimateId]
  );
  // Push notification to contractor
  const estResult = await pool.query(
    "SELECT user_id, project_name FROM estimates WHERE id = $1",
    [args.data.estimateId]
  );
  const est = estResult.rows[0];
  if (est) {
    try {
      const { sendPushNotification } = await import("./push");
      await sendPushNotification({ data: { userId: est.user_id, title: "Proposal Viewed", body: `Your proposal for ${est.project_name} was just viewed!`, url: `/estimates/${args.data.estimateId}` } });
    } catch {}
  }
  return { success: true };
}
registerHandler("tracking.logProposalView", _logProposalView);

export const logProposalView = createIsomorphicFn()
  .client(async (args: { data: { estimateId: string } }) => {
    const res = await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "tracking.logProposalView", args }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
    return res.json();
  })
  .server(_logProposalView);

// ---- getRecentViews ----
async function _getRecentViews() {
  const pool = getPool();
  const result = await pool.query(
    `SELECT pv.*, e.project_name, e.customer_name 
     FROM proposal_views pv 
     JOIN estimates e ON e.id = pv.estimate_id 
     ORDER BY pv.viewed_at DESC LIMIT 10`
  );
  return result.rows;
}
registerHandler("tracking.getRecentViews", _getRecentViews);

export const getRecentViews = createIsomorphicFn()
  .client(async () => {
    const res = await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "tracking.getRecentViews", args: {} }),
      credentials: "include",
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
    return res.json();
  })
  .server(_getRecentViews);
