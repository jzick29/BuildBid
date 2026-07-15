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

// Generate a branded PDF proposal for an estimate
export const generateProposal = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { estimateId: string; terms?: string })
  .handler(async ({ data }) => {
    const user = await requireUser();
    const mod = await import("./db.server");
    
    // Get estimate + line items
    const est = mod.getEstimateById(data.estimateId);
    if (!est || est.user_id !== user.id) throw redirect({ to: "/estimates" });
    const items = mod.getLineItems(data.estimateId);
    
    // Generate proposal number
    const db = await (await import("./db.server")).getDb();
    const count = db.query("SELECT COUNT(*) as c FROM proposals WHERE user_id = ?").get(user.id) as any;
    const proposalNumber = `PRO-${String((count?.c || 0) + 1).padStart(4, "0")}`;
    
    // Create proposal record in DB
    const proposalId = crypto.randomUUID();
    db.run(
      "INSERT INTO proposals (id, estimate_id, user_id, proposal_number, terms) VALUES (?, ?, ?, ?, ?)",
      [proposalId, est.id, user.id, proposalNumber, data.terms || ""]
    );
    
    // Generate PDF
    const pdfBytes = await generatePdf(user, est, items, proposalNumber, data.terms || "");
    
    // Store PDF as base64 in the proposal record
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
    db.run("UPDATE proposals SET pdf_data = ? WHERE id = ?", [pdfBase64, proposalId]);
    
    return {
      success: true,
      proposalId,
      proposalNumber,
      pdfBase64,
    };
  });

// Get all proposals for an estimate
export const getProposals = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { estimateId: string })
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = await (await import("./db.server")).getDb();
    const rows = db.query(
      "SELECT id, proposal_number, terms, created_at FROM proposals WHERE estimate_id = ? AND user_id = ? ORDER BY created_at DESC"
    ).all(data.estimateId, user.id) as any[];
    return { proposals: rows };
  });

// Get a specific proposal by ID (with PDF data)
export const getProposal = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = await (await import("./db.server")).getDb();
    const row = db.query(
      "SELECT p.*, e.project_name, e.customer_name, e.trade FROM proposals p JOIN estimates e ON e.id = p.estimate_id WHERE p.id = ? AND p.user_id = ?"
    ).get(data.id, user.id) as any;
    if (!row) throw redirect({ to: "/estimates" });
    return { proposal: row };
  });

// Generate PDF using pdf-lib
async function generatePdf(
  user: any,
  est: any,
  items: any[],
  proposalNumber: string,
  terms: string
): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
  
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  
  const page = doc.addPage([612, 792]); // US Letter
  const { width, height } = page.getSize();
  
  const indigo = rgb(0.4, 0.24, 0.93);
  const dark = rgb(0.13, 0.13, 0.13);
  const gray = rgb(0.45, 0.45, 0.45);
  const lightGray = rgb(0.85, 0.85, 0.85);
  const white = rgb(1, 1, 1);
  
  let y = height - 50;
  
  // --- Header ---
  page.drawText("BuildBid", { x: 50, y, size: 28, font: fontBold, color: indigo });
  page.drawText("Professional Estimate Proposal", { x: 50, y: y - 24, size: 12, font: font, color: gray });
  
  // Proposal number + date
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  page.drawText(`Proposal #${proposalNumber}`, { x: width - 200, y, size: 14, font: fontBold, color: dark });
  page.drawText(`Date: ${today}`, { x: width - 200, y: y - 18, size: 10, font: font, color: gray });
  
  y -= 60;
  
  // --- Divider ---
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: lightGray });
  y -= 20;
  
  // --- Contractor Info ---
  page.drawText("CONTRACTOR", { x: 50, y, size: 10, font: fontBold, color: gray });
  y -= 14;
  page.drawText(user.name || user.email, { x: 50, y, size: 12, font: fontBold, color: dark });
  y -= 14;
  page.drawText(user.email, { x: 50, y, size: 10, font: font, color: gray });
  
  // --- Client Info ---
  const clientX = width / 2;
  page.drawText("CLIENT", { x: clientX, y: y + 28, size: 10, font: fontBold, color: gray });
  page.drawText(est.customer_name, { x: clientX, y: y + 14, size: 12, font: fontBold, color: dark });
  
  y -= 30;
  
  // --- Project Info ---
  page.drawText("PROJECT", { x: 50, y, size: 10, font: fontBold, color: gray });
  y -= 14;
  page.drawText(est.project_name, { x: 50, y, size: 14, font: fontBold, color: dark });
  page.drawText(`Trade: ${est.trade?.charAt(0).toUpperCase() + est.trade?.slice(1)}`, { x: clientX, y, size: 10, font: font, color: gray });
  
  y -= 30;
  
  // --- Divider ---
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: lightGray });
  y -= 20;
  
  // --- Line Items Table Header ---
  const cols = [
    { x: 50, label: "Description", width: 220 },
    { x: 270, label: "Qty", width: 40 },
    { x: 310, label: "Unit", width: 60 },
    { x: 370, label: "Unit Cost", width: 80 },
    { x: 450, label: "Markup", width: 50 },
    { x: 500, label: "Total", width: 80 },
  ];
  
  // Table header background
  page.drawRectangle({ x: 50, y: y - 4, width: width - 100, height: 22, color: indigo });
  
  cols.forEach(col => {
    page.drawText(col.label, { x: col.x, y: y + 2, size: 9, font: fontBold, color: white });
  });
  y -= 22;
  
  // Table rows
  let subtotal = 0;
  let grandTotal = 0;
  
  for (const item of items) {
    const lineTotal = (item.quantity * item.unit_cost) * (1 + (item.markup_percent || 0) / 100);
    subtotal += item.quantity * item.unit_cost;
    grandTotal += lineTotal;
    
    // Check if we need a new page
    if (y < 120) {
      // Add a new page
      const newPage = doc.addPage([612, 792]);
      y = height - 50;
      
      // Re-draw header on new page
      newPage.drawText("BuildBid", { x: 50, y, size: 20, font: fontBold, color: indigo });
      newPage.drawText(`${est.project_name} - Proposal #${proposalNumber} (cont.)`, { x: 50, y: y - 18, size: 10, font: font, color: gray });
      y -= 40;
      
      // Table header on new page
      newPage.drawRectangle({ x: 50, y: y - 4, width: width - 100, height: 22, color: indigo });
      cols.forEach(col => {
        newPage.drawText(col.label, { x: col.x, y: y + 2, size: 9, font: fontBold, color: white });
      });
      y -= 22;
    }
    
    page.drawText(item.description, { x: 50, y, size: 10, font: font, color: dark });
    page.drawText(String(item.quantity), { x: 270, y, size: 10, font: font, color: dark });
    page.drawText(item.unit, { x: 310, y, size: 10, font: font, color: dark });
    page.drawText(`$${Number(item.unit_cost).toFixed(2)}`, { x: 370, y, size: 10, font: font, color: dark });
    page.drawText(`${item.markup_percent || 0}%`, { x: 450, y, size: 10, font: font, color: dark });
    page.drawText(`$${lineTotal.toFixed(2)}`, { x: 500, y, size: 10, font: fontBold, color: dark });
    
    y -= 18;
  }
  
  y -= 10;
  
  // --- Divider ---
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: lightGray });
  y -= 16;
  
  // Totals
  page.drawText("Subtotal", { x: 400, y, size: 11, font: font, color: gray });
  page.drawText(`$${subtotal.toFixed(2)}`, { x: 500, y, size: 11, font: font, color: dark });
  y -= 18;
  
  page.drawText("Total", { x: 400, y, size: 14, font: fontBold, color: indigo });
  page.drawText(`$${grandTotal.toFixed(2)}`, { x: 500, y, size: 14, font: fontBold, color: indigo });
  
  y -= 40;
  
  // --- Divider ---
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: lightGray });
  y -= 20;
  
  // --- Terms & Notes ---
  if (terms) {
    page.drawText("TERMS & NOTES", { x: 50, y, size: 10, font: fontBold, color: gray });
    y -= 16;
    // Wrap terms text
    const words = terms.split(" ");
    let line = "";
    for (const word of words) {
      const test = line + word + " ";
      if (test.length * 5 > 500) { // Approximate width check
        page.drawText(line.trim(), { x: 50, y, size: 9, font: font, color: dark });
        y -= 14;
        line = word + " ";
      } else {
        line = test;
      }
    }
    if (line.trim()) {
      page.drawText(line.trim(), { x: 50, y, size: 9, font: font, color: dark });
      y -= 20;
    }
  }
  
  y -= 20;
  
  // --- Footer ---
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: lightGray });
  y -= 14;
  page.drawText("Generated by BuildBid — buildbid.app", { x: 50, y, size: 8, font: font, color: gray });
  page.drawText(`Proposal #${proposalNumber}`, { x: width - 150, y, size: 8, font: font, color: gray });
  
  return await doc.save();
}