/**
 * BuildBid Export Module — Excel (xlsx) and CSV generation for estimates.
 * Uses exceljs (pure JS, no native deps, works on Vercel).
 */

import ExcelJS from "exceljs";

interface EstimateRow { project_name: string; customer_name: string; trade: string; markup_percent: number; tax_rate: number; status: string; created_at: string; notes: string; }
interface LineItem { name: string; description: string; quantity: number; unit: string; unit_cost: number; total: number; sort_order: number; }
interface EstimateData { estimate: EstimateRow; items: LineItem[]; }

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const HEADER_BORDER: Partial<ExcelJS.Borders> = { bottom: { style: "medium", color: { argb: "FFCBD5E1" } } };
const DATA_BORDER: Partial<ExcelJS.Borders> = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
const ALT_ROW_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
const TOTAL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };

export async function generateExcelWorkbook(data: EstimateData): Promise<Buffer> {
  const { estimate, items } = data;
  const wb = new ExcelJS.Workbook();
  wb.creator = "BuildBid"; wb.created = new Date();

  const sheet1 = wb.addWorksheet("Estimate", { views: [{ state: "frozen", ySplit: 4 }] });
  buildHeaderSheet(sheet1, estimate);
  buildItemsTable(sheet1, estimate, items);

  const sheet2 = wb.addWorksheet("Summary");
  buildSummarySheet(sheet2, estimate, items);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function buildHeaderSheet(sheet: ExcelJS.Worksheet, est: EstimateRow): void {
  sheet.mergeCells("A1:F1");
  const tc = sheet.getCell("A1"); tc.value = `${est.project_name} — Estimate`; tc.font = { bold: true, size: 18, color: { argb: "FF1E293B" } }; sheet.getRow(1).height = 30;
  sheet.mergeCells("A2:F2");
  const mc = sheet.getCell("A2"); mc.value = `Customer: ${est.customer_name}  |  Trade: ${est.trade}  |  Status: ${est.status}  |  Date: ${new Date(est.created_at).toLocaleDateString()}`; mc.font = { color: { argb: "FF64748B" }, size: 10 }; sheet.getRow(2).height = 20;
  sheet.getRow(3).height = 8;
  sheet.getColumn(1).width = 32; sheet.getColumn(2).width = 40; sheet.getColumn(3).width = 10; sheet.getColumn(4).width = 10; sheet.getColumn(5).width = 12; sheet.getColumn(6).width = 14;
}

function buildItemsTable(sheet: ExcelJS.Worksheet, est: EstimateRow, items: LineItem[]): void {
  const headers = ["Item", "Description", "Qty", "Unit", "Unit Cost", "Total"];
  const hr = sheet.getRow(4);
  headers.forEach((h, i) => {
    const c = hr.getCell(i + 1); c.value = h; c.font = HEADER_FONT; c.fill = HEADER_FILL;
    c.alignment = { horizontal: i >= 2 ? "center" : "left", vertical: "middle" }; c.border = HEADER_BORDER;
  }); hr.height = 24;

  let ri = 5, subtotal = 0;
  items.forEach((item, i) => {
    const row = sheet.getRow(ri), total = item.quantity * item.unit_cost;
    row.getCell(1).value = item.name; row.getCell(2).value = item.description || ""; row.getCell(3).value = item.quantity; row.getCell(4).value = item.unit; row.getCell(5).value = item.unit_cost; row.getCell(6).value = total;
    for (let c = 1; c <= 6; c++) { const cell = row.getCell(c); cell.font = { size: 10 }; cell.border = DATA_BORDER; cell.alignment = { vertical: "middle", horizontal: c >= 3 ? "center" : "left" }; }
    row.getCell(5).numFmt = "$#,##0.00"; row.getCell(6).numFmt = "$#,##0.00";
    if (i % 2 === 1) for (let c = 1; c <= 6; c++) row.getCell(c).fill = ALT_ROW_FILL;
    row.height = 20; subtotal += total; ri++;
  });
  ri++;
  const markup = subtotal * (est.markup_percent / 100), tax = (subtotal + markup) * (est.tax_rate / 100), grand = subtotal + markup + tax;
  const totals = [{ l: "Subtotal", v: subtotal }, { l: `Markup (${est.markup_percent}%)`, v: markup }, { l: `Tax (${(est.tax_rate * 100).toFixed(2)}%)`, v: tax }, { l: "TOTAL", v: grand }];
  totals.forEach((t, i) => {
    const row = sheet.getRow(ri); sheet.mergeCells(`A${ri}:D${ri}`);
    row.getCell(1).value = t.l; row.getCell(1).font = { bold: true, size: 10 }; row.getCell(1).alignment = { horizontal: "right", vertical: "middle" };
    row.getCell(6).value = t.v; row.getCell(6).numFmt = "$#,##0.00"; row.getCell(6).font = { bold: i === 3, size: 10 }; row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
    for (let c = 1; c <= 6; c++) { row.getCell(c).fill = TOTAL_FILL; row.getCell(c).border = { bottom: { style: i === 3 ? "double" : "thin", color: { argb: "FFCBD5E1" } } }; }
    row.height = 22; ri++;
  });
  if (est.notes) { ri++; sheet.mergeCells(`A${ri}:F${ri}`); sheet.getCell(`A${ri}`).value = `Notes: ${est.notes}`; sheet.getCell(`A${ri}`).font = { italic: true, size: 9, color: { argb: "FF94A3B8" } }; }
}

function buildSummarySheet(sheet: ExcelJS.Worksheet, est: EstimateRow, items: LineItem[]): void {
  sheet.getColumn(1).width = 28; sheet.getColumn(2).width = 20;
  sheet.mergeCells("A1:B1"); sheet.getCell("A1").value = "Estimate Summary"; sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF1E293B" } }; sheet.getRow(1).height = 28;
  const meta = [["Project", est.project_name], ["Customer", est.customer_name], ["Trade", est.trade], ["Status", est.status], ["Date", new Date(est.created_at).toLocaleDateString()], [" ", ""], ["Items", items.length.toString()]];
  let r = 3;
  meta.forEach(([l, v]) => { sheet.getRow(r).getCell(1).value = l; sheet.getRow(r).getCell(1).font = { bold: true, size: 10, color: { argb: "FF475569" } }; sheet.getRow(r).getCell(2).value = v; sheet.getRow(r).getCell(2).font = { size: 10 }; r++; });
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0), markup = subtotal * (est.markup_percent / 100), tax = (subtotal + markup) * (est.tax_rate / 100), total = subtotal + markup + tax;
  r++; sheet.getRow(r).getCell(1).value = "FINANCIALS"; sheet.getRow(r).getCell(1).font = { bold: true, size: 10, color: { argb: "FF4F46E5" } }; r++;
  const fin = [["Subtotal", subtotal], [`Markup (${est.markup_percent}%)`, markup], ["Tax Rate", `${(est.tax_rate * 100).toFixed(2)}%`], ["Tax Amount", tax], ["Grand Total", total]];
  fin.forEach(([l, v]) => { const row = sheet.getRow(r); row.getCell(1).value = l; row.getCell(1).font = { bold: l === "Grand Total", size: 10 }; const vc = row.getCell(2); vc.value = typeof v === "number" ? v : v.toString(); if (typeof v === "number") vc.numFmt = "$#,##0.00"; vc.font = { bold: l === "Grand Total", size: 10 }; row.height = 20; r++; });
}

export function generateCSV(data: EstimateData): string {
  const { estimate, items } = data; const lines: string[] = [];
  lines.push(`"${escapeCSV(estimate.project_name)} — Estimate"`);
  lines.push(`"Customer: ${escapeCSV(estimate.customer_name)}","Trade: ${escapeCSV(estimate.trade)}","Status: ${estimate.status}","Date: ${new Date(estimate.created_at).toLocaleDateString()}"`);
  lines.push(""); lines.push("Item,Description,Qty,Unit,Unit Cost,Total");
  let subtotal = 0;
  for (const item of items) { const total = item.quantity * item.unit_cost; subtotal += total; lines.push([escapeCSV(item.name), escapeCSV(item.description || ""), item.quantity, item.unit, item.unit_cost.toFixed(2), total.toFixed(2)].join(",")); }
  const markup = subtotal * (estimate.markup_percent / 100), tax = (subtotal + markup) * (estimate.tax_rate / 100), grandTotal = subtotal + markup + tax;
  lines.push(""); lines.push(`Subtotal,,,,"","${subtotal.toFixed(2)}"`); lines.push(`Markup (${estimate.markup_percent}%),,,,"","${markup.toFixed(2)}"`); lines.push(`Tax (${(estimate.tax_rate * 100).toFixed(2)}%),,,,"","${tax.toFixed(2)}"`); lines.push(`TOTAL,,,,"","${grandTotal.toFixed(2)}"`);
  return lines.join("\n");
}
function escapeCSV(val: string): string { if (val.includes(",") || val.includes('"') || val.includes("\n")) return `"${val.replace(/"/g, '""')}"`; return val; }
