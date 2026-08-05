import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/free-estimating-template-pdf/")({
  component: PdfTemplatePage,
  loader: async () => ({}),
});

function PdfTemplatePage() {
  const items = [
    { description: "Item description goes here", qty: 1, unit: "each", unitCost: 150.00, markup: 20, total: 180.00 },
    { description: "Second line item example", qty: 2, unit: "hr", unitCost: 85.00, markup: 15, total: 195.50 },
    { description: "Third line item example", qty: 1, unit: "each", unitCost: 420.00, markup: 10, total: 462.00 },
    { description: "", qty: 0, unit: "", unitCost: 0, markup: 0, total: 0 },
    { description: "", qty: 0, unit: "", unitCost: 0, markup: 0, total: 0 },
    { description: "", qty: 0, unit: "", unitCost: 0, markup: 0, total: 0 },
    { description: "", qty: 0, unit: "", unitCost: 0, markup: 0, total: 0 },
    { description: "", qty: 0, unit: "", unitCost: 0, markup: 0, total: 0 },
    { description: "", qty: 0, unit: "", unitCost: 0, markup: 0, total: 0 },
    { description: "", qty: 0, unit: "", unitCost: 0, markup: 0, total: 0 },
  ];

  const subtotal = items.reduce((s, i) => s + (i.qty * i.unitCost), 0);
  const grandTotal = items.reduce((s, i) => s + i.total, 0);

  return (
    <>
      <style>{`
        @media screen {
          body { background: #f3f4f6; margin: 0; padding: 0; }
          .print-bar { display: flex; justify-content: center; gap: 12px; padding: 16px; background: #1f2937; color: white; font-family: system-ui; position: sticky; top: 0; z-index: 50; }
          .print-bar button { background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; cursor: pointer; }
          .print-bar button:hover { background: #4338ca; }
          .page { max-width: 800px; margin: 40px auto; box-shadow: 0 4px 24px rgba(0,0,0,0.12); }
        }
        @media print {
          body { margin: 0; padding: 0; }
          .print-bar { display: none !important; }
          .page { box-shadow: none !important; max-width: 100% !important; margin: 0 !important; }
          @page { margin: 0.5in; size: letter; }
        }
        .page { background: white; font-family: system-ui, -apple-system, sans-serif; color: #111827; padding: 48px 56px; line-height: 1.6; }
        .page h1 { font-size: 24px; margin: 0 0 4px; }
        .page .subtitle { color: #6b7280; font-size: 14px; margin: 0 0 24px; }
        .page .meta { display: flex; justify-content: space-between; margin-bottom: 32px; font-size: 13px; }
        .page .meta strong { color: #374151; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
        table th { background: #f9fafb; text-align: left; padding: 10px 12px; border-bottom: 2px solid #e5e7eb; font-weight: 600; color: #374151; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
        table td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
        table .num { text-align: right; font-variant-numeric: tabular-nums; }
        table .empty td { color: #d1d5db; border-bottom: 1px solid #f9fafb; }
        .totals { text-align: right; font-size: 14px; margin-bottom: 32px; }
        .totals .row { display: flex; justify-content: flex-end; padding: 4px 0; }
        .totals .row .label { width: 200px; color: #6b7280; }
        .totals .row .value { width: 120px; text-align: right; font-variant-numeric: tabular-nums; }
        .totals .grand { font-size: 18px; font-weight: 700; border-top: 2px solid #111827; margin-top: 4px; padding-top: 8px; }
        .terms { border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 12px; color: #6b7280; margin-bottom: 32px; }
        .terms strong { color: #374151; }
        .footer { font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 16px; }
        .footer a { color: #4f46e5; text-decoration: none; }
        .brand { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
        .brand .logo { width: 36px; height: 36px; background: #4f46e5; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 16px; }
        .brand .name { font-size: 18px; font-weight: 700; }
      `}</style>

      <div className="print-bar">
        <button onClick={() => window.print()}>🖨️ Print / Save as PDF</button>
        <Link to="/download-free-estimating-template" style={{ color: '#a5b4fc', fontSize: '14px', alignSelf: 'center' }}>
          ← Back to download
        </Link>
      </div>

      <div className="page">
        <div className="brand">
          <div className="logo">BB</div>
          <div className="name">BuildBid</div>
        </div>

        <h1>Estimating Template</h1>
        <p className="subtitle">Professional construction estimate — print or save as PDF</p>

        <div className="meta">
          <div>
            <strong>Prepared For:</strong> __________________________<br />
            <strong>Project:</strong> __________________________<br />
            <strong>Date:</strong> {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </div>
          <div style={{ textAlign: "right" }}>
            <strong>Estimate #:</strong> __________<br />
            <strong>Trade:</strong> ____________________<br />
            <strong>Your Company:</strong> ____________________
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: "40%" }}>Description</th>
              <th className="num" style={{ width: "8%" }}>Qty</th>
              <th style={{ width: "10%" }}>Unit</th>
              <th className="num" style={{ width: "12%" }}>Unit Cost</th>
              <th className="num" style={{ width: "10%" }}>Markup %</th>
              <th className="num" style={{ width: "15%" }}>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className={!item.description ? "empty" : ""}>
                <td>{item.description || "—"}</td>
                <td className="num">{item.qty || "—"}</td>
                <td>{item.unit || "—"}</td>
                <td className="num">{item.unitCost ? `$${item.unitCost.toFixed(2)}` : "—"}</td>
                <td className="num">{item.markup ? `${item.markup}%` : "—"}</td>
                <td className="num">{item.total ? `$${item.total.toFixed(2)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals">
          <div className="row"><span className="label">Subtotal</span><span className="value">${subtotal.toFixed(2)}</span></div>
          <div className="row grand"><span className="label">Grand Total</span><span className="value">${grandTotal.toFixed(2)}</span></div>
        </div>

        <div className="terms">
          <strong>Terms & Conditions:</strong> Payment due upon completion unless otherwise agreed. All materials remain property of contractor until paid in full. Estimate valid for 30 days. Change orders require written approval before work begins. Pricing includes labor and materials as specified above. Any additional work not listed requires a separate estimate or change order.
        </div>

        <div className="footer">
          <p>Created with <a href="https://buildbid.pro">BuildBid</a> — Construction Estimating Software</p>
          <p>Questions? Email support@buildbid.pro</p>
          <p style={{ marginTop: 8 }}>© {new Date().getFullYear()} BuildBid. All rights reserved.</p>
        </div>
      </div>
    </>
  );
}
