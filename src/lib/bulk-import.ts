// Bulk supplier import — CSV/Excel parsing, column mapping, upsert into materials
import { makeAuthFn } from "./iso";

// ─── Parse uploaded file ──────────────────────────────────────────

export const parseImportFile = makeAuthFn("bulkImport.parseFile", async (
  args: { data: { base64Data: string; fileName: string; mediaType: string } },
  _userId, _pool
) => {
  const { base64Data, fileName, mediaType } = args.data;
  const buffer = Buffer.from(base64Data, "base64");

  let rows: Record<string, string | number>[] = [];

  const isCsv = fileName.endsWith(".csv") || mediaType.includes("csv");
  const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || mediaType.includes("spreadsheet");

  if (isCsv) {
    const { parse } = await import("csv-parse/sync");
    const text = buffer.toString("utf-8");
    const parsed: string[][] = parse(text, {
      columns: false,
      skip_empty_lines: true,
      relax_column_count: true,
    });
    if (parsed.length < 2) throw new Error("CSV must have a header row and at least one data row");
    const headers = parsed[0].map((h: string) => h.trim());
    rows = parsed.slice(1).map((line: string[]) => {
      const obj: Record<string, string | number> = {};
      headers.forEach((h, i) => { obj[h] = (line[i] || "").trim(); });
      return obj;
    });
  } else if (isExcel) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("No sheet found in workbook");
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, string | number>[];
    if (rows.length === 0) throw new Error("No data rows found in spreadsheet");
  } else {
    throw new Error("Unsupported file type. Please upload CSV or Excel (.xlsx/.xls)");
  }

  // Extract column names from first row
  const columns = Object.keys(rows[0]);

  return { columns, rows, rowCount: rows.length };
});

// ─── Run the import ────────────────────────────────────────────────

const BID_FIELDS: Record<string, string> = {
  name: "Name",
  sku: "SKU",
  unit: "Unit",
  unit_cost: "Unit Cost",
  category: "Category",
  supplier: "Supplier",
  description: "Description",
};

export const runBulkImport = makeAuthFn("bulkImport.runImport", async (
  args: { data: { columnMap: Record<string, string>; rows: Record<string, string | number>[]; supplierName?: string } },
  userId, pool
) => {
  const { columnMap, rows, supplierName } = args.data;
  const importId = crypto.randomUUID();
  let created = 0, updated = 0, skipped = 0;

  for (const row of rows) {
    // Map supplier columns → BuildBid fields
    const name = String(row[columnMap.name] || "").trim();
    const sku = String(row[columnMap.sku] || "").trim();
    const unit = String(row[columnMap.unit] || "").trim() || "each";
    const unitCost = parseFloat(String(row[columnMap.unit_cost] || "0")) || 0;
    const trade = String(row[columnMap.category] || "").trim();
    const supplier = String(row[columnMap.supplier] || supplierName || "").trim();
    const description = columnMap.description ? String(row[columnMap.description] || "").trim() : "";

    if (!name) { skipped++; continue; }

    // Upsert: match on user_id + supplier + sku (if sku present), otherwise user_id + supplier + name
    let existing: any = null;
    if (sku && supplier) {
      existing = (await pool.query(
        "SELECT id, unit_cost FROM materials WHERE user_id = $1 AND supplier = $2 AND sku = $3",
        [userId, supplier, sku]
      )).rows[0];
    }
    if (!existing && name && supplier) {
      existing = (await pool.query(
        "SELECT id, unit_cost FROM materials WHERE user_id = $1 AND supplier = $2 AND name = $3 AND sku = ''",
        [userId, supplier, name]
      )).rows[0];
    }

    if (existing) {
      await pool.query(
        "UPDATE materials SET unit_cost = $1, name = $2, unit = $3, trade = $4, description = $5, sku = $6 WHERE id = $7",
        [unitCost, name, unit, trade, description, sku, existing.id]
      );
      updated++;
    } else {
      await pool.query(
        "INSERT INTO materials (id, user_id, name, description, unit, unit_cost, trade, supplier, sku) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [crypto.randomUUID(), userId, name, description, unit, unitCost, trade, supplier, sku]
      );
      created++;
    }
  }

  // Log import history
  await pool.query(
    "INSERT INTO import_history (id, user_id, supplier, file_type, rows_total, rows_created, rows_updated, rows_skipped, column_map) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [importId, userId, supplierName || "", rows.length > 0 ? "csv/excel" : "unknown", rows.length, created, updated, skipped, JSON.stringify(columnMap)]
  );

  return { importId, created, updated, skipped };
});

// ─── Import history ────────────────────────────────────────────────

export const getImportHistory = makeAuthFn("bulkImport.getHistory", async (_args, userId, pool) => {
  return (await pool.query(
    "SELECT * FROM import_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
    [userId]
  )).rows;
});
