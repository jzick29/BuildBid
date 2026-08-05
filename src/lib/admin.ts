import { createServerFn } from "@tanstack/react-start";
import { getCookie, deleteCookie } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { makeAuthFn } from "./iso";

const SESSION_COOKIE = "buildbid_session";

// Admin guard — throws redirect if not admin
async function requireAdmin() {
  const token = getCookie(SESSION_COOKIE);
  if (!token) throw redirect({ to: "/login" });
  const db = await (await import("./db.server")).getDb();
  const row = db.query(
    "SELECT u.id, u.email, u.role, u.frozen FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > datetime('now')"
  ).get(token) as any;
  if (!row || row.role !== "admin" || row.frozen === 1) {
    if (row?.frozen === 1) deleteCookie(SESSION_COOKIE, { path: "/" });
    throw redirect({ to: "/dashboard" });
  }
  return row;
}

// List all users with subscription info
export const listUsers = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const db = await (await import("./db.server")).getDb();
  const rows = db.query(`
    SELECT u.id, u.email, u.name, u.subscription_tier, u.trial_ends_at,
           u.created_at, u.role, u.frozen,
           (SELECT COUNT(*) FROM estimates e WHERE e.user_id = u.id) as estimate_count
    FROM users u
    ORDER BY u.created_at DESC
  `).all() as any[];
  // Calculate stats
  const stats = {
    total: rows.length,
    activeTrials: rows.filter((r: any) => r.subscription_tier === "trial" && r.frozen === 0).length,
    paying: rows.filter((r: any) => ["starter", "pro", "shop"].includes(r.subscription_tier)).length,
    frozen: rows.filter((r: any) => r.frozen === 1).length,
  };
  return { users: rows, stats };
});

// Change a user's subscription tier
export const setUserPlan = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const v = d as { userId: string; tier: string };
    if (!v.userId) throw new Error("User ID required");
    if (!["trial", "free", "starter", "pro", "shop"].includes(v.tier))
      throw new Error("Invalid tier");
    return v;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await (await import("./db.server")).getDb();
    db.run("UPDATE users SET subscription_tier = ? WHERE id = ?", [data.tier, data.userId]);
    return { success: true };
  });

// Toggle frozen status
export const toggleUserFrozen = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const v = d as { userId: string };
    if (!v.userId) throw new Error("User ID required");
    return v;
  })
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (data.userId === admin.id) throw new Error("Cannot freeze yourself");
    const db = await (await import("./db.server")).getDb();
    const user = db.query("SELECT frozen FROM users WHERE id = ?").get(data.userId) as any;
    if (!user) throw new Error("User not found");
    const newFrozen = user.frozen === 1 ? 0 : 1;
    db.run("UPDATE users SET frozen = ? WHERE id = ?", [newFrozen, data.userId]);
    db.run("DELETE FROM sessions WHERE user_id = ?", [data.userId]);
    return { success: true, frozen: newFrozen === 1 };
  });

// Delete a user and all their data
export const deleteUser = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const v = d as { userId: string };
    if (!v.userId) throw new Error("User ID required");
    return v;
  })
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (data.userId === admin.id) throw new Error("Cannot delete yourself");
    const db = await (await import("./db.server")).getDb();
    // ON DELETE CASCADE handles related records
    db.run("DELETE FROM users WHERE id = ?", [data.userId]);
    return { success: true };
  });

// Payment history — list all payments for admin dashboard
export const listPayments = makeAuthFn("admin.listPayments", async (args: { data: { status?: string } }, userId, _pool) => {
  const { data } = args;
  const db = await (await import("./db.server")).getDb();
  let sql = `SELECT p.*, u.email as user_email, i.invoice_number 
    FROM payments p 
    LEFT JOIN users u ON u.id = p.user_id 
    LEFT JOIN invoices i ON i.id = p.invoice_id`;
  const params: any[] = [];
  if (data?.status) {
    sql += " WHERE p.status = ?";
    params.push(data.status);
  }
  sql += " ORDER BY p.created_at DESC LIMIT 100";
  const payments = db.query(sql).all(...params);
  return { payments };
});

// Payment stats for admin dashboard
export const getPaymentStats = makeAuthFn("admin.getPaymentStats", async (_args: any, _userId, _pool) => {
  const db = await (await import("./db.server")).getDb();
  const total = db.query("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'").get() as any;
  const thisMonth = db.query(
    "SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed' AND created_at >= date('now', 'start of month')"
  ).get() as any;
  const byTier = db.query(
    "SELECT u.subscription_tier, COUNT(*) as count, COALESCE(SUM(p.amount), 0) as total FROM payments p JOIN users u ON u.id = p.user_id WHERE p.status = 'completed' GROUP BY u.subscription_tier"
  ).all() as any[];
  return {
    totalRevenue: total?.total || 0,
    totalCount: total?.count || 0,
    thisMonthRevenue: thisMonth?.total || 0,
    thisMonthCount: thisMonth?.count || 0,
    byTier,
  };
});
