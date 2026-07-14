import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { getCookie, deleteCookie } from "@tanstack/react-start/server";

const SESSION_COOKIE = "buildbid_session";

async function requireUser() {
  const db = await (await import("./db.server")).getDb();
  const token = getCookie(SESSION_COOKIE);
  if (!token) throw redirect({ to: "/login" });
  const row = db.query(
    "SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > datetime('now')"
  ).get(token) as any;
  if (!row) {
    deleteCookie(SESSION_COOKIE, { path: "/" });
    throw redirect({ to: "/login" });
  }
  return row;
}

export const listEstimates = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const mod = await import("./db.server");
  return mod.getEstimatesByUser(user.id);
});

export const getEstimate = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const user = await requireUser();
    const mod = await import("./db.server");
    const est = mod.getEstimateById(data.id);
    if (!est || est.user_id !== user.id) throw redirect({ to: "/estimates" });
    const items = mod.getLineItems(data.id);
    return { estimate: est, lineItems: items };
  });

export const createEstimate = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const v = d as { projectName: string; customerName: string; trade: string };
    if (!v.projectName?.trim()) throw new Error("Project name is required");
    if (!v.customerName?.trim()) throw new Error("Customer name is required");
    if (!v.trade) throw new Error("Trade type is required");
    return v;
  })
  .handler(async ({ data }) => {
    const user = await requireUser();
    const mod = await import("./db.server");
    const id = mod.createEstimate(user.id, data.projectName.trim(), data.customerName.trim(), data.trade);
    return { id };
  });

export const addLineItem = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const v = d as { estimateId: string; description: string; quantity: number; unit: string; unitCost: number; markupPercent: number };
    if (!v.estimateId) throw new Error("Estimate ID required");
    if (!v.description?.trim()) throw new Error("Description is required");
    return v;
  })
  .handler(async ({ data }) => {
    await requireUser();
    const mod = await import("./db.server");
    mod.addLineItem(data.estimateId, {
      description: data.description.trim(),
      quantity: data.quantity || 1,
      unit: data.unit || "each",
      unit_cost: data.unitCost || 0,
      markup_percent: data.markupPercent || 0,
    });
    return { success: true };
  });

export const removeLineItem = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    await requireUser();
    const mod = await import("./db.server");
    mod.deleteLineItem(data.id);
    return { success: true };
  });

export const updateEstimateStatus = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { id: string; status: string })
  .handler(async ({ data }) => {
    await requireUser();
    const mod = await import("./db.server");
    mod.updateEstimate(data.id, { status: data.status });
    return { success: true };
  });

export const deleteEstimate = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    await requireUser();
    const mod = await import("./db.server");
    mod.deleteEstimate(data.id);
    return { success: true };
  });

// Re-export auth helpers for convenience
export { getCurrentUser } from "./auth";
