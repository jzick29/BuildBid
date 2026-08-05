import type { IncomingMessage, ServerResponse } from "http";
import { getPool } from "../../lib/db.server";
import { generateExcelWorkbook, generateCSV } from "../../lib/exports";

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const estimateId = url.searchParams.get("id");
    const format = url.searchParams.get("format") || "xlsx";
    if (!estimateId) return new Response(JSON.stringify({ error: "Missing estimate ID" }), { status: 400, headers: { "Content-Type": "application/json" } });

    const pool = getPool();
    const cookieHeader = req.headers.get("cookie") || "";
    const sessionMatch = cookieHeader.match(/session=([^;]+)/);
    if (!sessionMatch) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    const sessionRes = await pool.query("SELECT user_id FROM sessions WHERE token = $1", [sessionMatch[1]]);
    if (sessionRes.rows.length === 0) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    const userId = sessionRes.rows[0].user_id;

    const estRes = await pool.query("SELECT * FROM estimates WHERE id = $1 AND user_id = $2", [estimateId, userId]);
    if (estRes.rows.length === 0) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    const estimate = estRes.rows[0];
    const itemsRes = await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [estimateId]);
    const items = itemsRes.rows.map((r: any) => ({ name: r.name, description: r.description || "", quantity: Number(r.quantity) || 0, unit: r.unit || "each", unit_cost: Number(r.unit_cost) || 0, total: (Number(r.quantity) || 0) * (Number(r.unit_cost) || 0), sort_order: r.sort_order }));

    const data = {
      estimate: { project_name: estimate.project_name, customer_name: estimate.customer_name || "—", trade: estimate.trade || "General", markup_percent: Number(estimate.markup_percent) || 0, tax_rate: Number(estimate.tax_rate) || 0, status: estimate.status || "draft", created_at: estimate.created_at, notes: estimate.notes || "" },
      items,
    };

    const safeName = sanitizeFilename(estimate.project_name);

    if (format === "csv") {
      const csv = generateCSV(data);
      return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${safeName}-estimate.csv"` } });
    }

    const buffer = await generateExcelWorkbook(data);
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${safeName}-estimate.xlsx"` } });
  } catch (err: any) {
    console.error("Export error:", err);
    return new Response(JSON.stringify({ error: "Export failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

function sanitizeFilename(name: string): string { return name.replace(/[^a-zA-Z0-9-_\s]/g, "").replace(/\s+/g, "-").slice(0, 60); }
