import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";

export const Route = createFileRoute("/invoices/$id")({ component: InvoiceDetailPage });

function InvoiceDetailPage() {
  const router = useRouter();
  const params = Route.useParams() as { id: string } | undefined;
  const id = params?.id;
  if (!id) return null;
  const [user, setUser] = useState<any>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [discountType, setDiscountType] = useState("");
  const [discountValue, setDiscountValue] = useState("0");
  const [status, setStatus] = useState("");

  // Item editing
  const [editingItems, setEditingItems] = useState(false);
  const [editItems, setEditItems] = useState<any[]>([]);

  // PDF / actions
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfBase64, setPdfBase64] = useState("");
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminders, setReminders] = useState<any[]>([]);
  const [generatingPaymentLink, setGeneratingPaymentLink] = useState(false);
  const [sendingPaymentLink, setSendingPaymentLink] = useState(false);

  const loadInvoice = useCallback(async () => {
    try {
      const res = await fetch("/api/call", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "invoices.getInvoice", args: { data: { id } } }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.status === 404 || data.error) { setError("Invoice not found"); return; }
      setInvoice(data);
      setItems(data.items || []);
      setReminders(data.reminders || []);
      setNotes(data.notes || "");
      setDueDate(data.due_date || "");
      setTaxRate(String(data.tax_rate || 0));
      setDiscountType(data.discount_type || "");
      setDiscountValue(String(data.discount_value || 0));
      setStatus(data.status || "draft");
      setPdfBase64(data.pdf_data || "");
      setEditItems((data.items || []).map((it: any) => ({ ...it, _changed: false })));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      if (!meData.user) { window.location.href = "/login"; return; }
      setUser(meData.user);
      await loadInvoice();
    })();
  }, [loadInvoice]);

  const callApi = async (fn: string, data: any) => {
    const res = await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: fn, args: { data } }),
      credentials: "include",
    });
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    return result;
  };

  const handleSaveField = async (field: string, value: any) => {
    try {
      await callApi("invoices.updateInvoice", { id, [field]: value });
      setInvoice((prev: any) => ({ ...prev, [field]: value }));
    } catch (e: any) { alert("Save failed: " + e.message); }
  };

  const recalcTotals = (invItems: any[], tRate: number, dType: string, dVal: number) => {
    const subtotal = invItems.reduce((sum: number, it: any) => {
      return sum + (it.quantity || 1) * (it.unit_cost || 0) * (1 + (it.markup_percent || 0) / 100);
    }, 0);
    let discountAmt = 0;
    if (dType === "percentage") discountAmt = subtotal * (dVal / 100);
    else if (dType === "fixed") discountAmt = dVal;
    const afterDiscount = Math.max(0, subtotal - discountAmt);
    const taxAmt = afterDiscount * (tRate / 100);
    const total = afterDiscount + taxAmt;
    return { subtotal: Math.round(subtotal * 100) / 100, discountAmount: Math.round(discountAmt * 100) / 100, taxAmount: Math.round(taxAmt * 100) / 100, total: Math.round(total * 100) / 100 };
  };

  const handleRecalcAndSave = async () => {
    const tRate = parseFloat(taxRate) || 0;
    const dVal = parseFloat(discountValue) || 0;
    const totals = recalcTotals(editItems, tRate, discountType, dVal);
    const updates = {
      id, subtotal: totals.subtotal,
      taxRate: tRate, taxAmount: totals.taxAmount,
      discountType, discountValue: dVal, discountAmount: totals.discountAmount,
      total: totals.total,
    };
    try {
      await callApi("invoices.updateInvoice", updates);
      await callApi("invoices.saveInvoiceItems", { invoiceId: id, items: editItems.map(({ _changed, ...rest }: any) => rest) });
      await loadInvoice();
      setEditingItems(false);
    } catch (e: any) { alert("Save failed: " + e.message); }
  };

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      const result = await callApi("invoices.generatePdf", { id });
      setPdfBase64(result.pdfBase64);
      handleDownloadPdf(result.pdfBase64, result.invoiceNumber);
    } catch (e: any) { alert("PDF generation failed: " + e.message); }
    finally { setGeneratingPdf(false); }
  };

  const handleDownloadPdf = (b64: string, num: string) => {
    const byteChars = atob(b64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNums)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${num || "invoice"}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendReminder = async () => {
    setSendingReminder(true);
    try {
      await callApi("invoices.sendReminder", { id });
      alert("Reminder logged! Connect email integration to auto-send.");
      await loadInvoice();
    } catch (e: any) { alert("Failed: " + e.message); }
    finally { setSendingReminder(false); }
  };
  const handlePayNow = async () => {
    setGeneratingPaymentLink(true);
    try {
      const result = await callApi("payments.createPaymentLink", {
        invoiceId: id,
        amount: invoice.total,
        description: "Invoice " + (invoice.invoice_number || id.slice(0, 8)),
      });
      if (result.url) {
        window.open(result.url, "_blank");
        alert("Payment link opened in new tab. This invoice will be marked paid automatically.");
      }
    } catch (e: any) { alert("Failed to create payment link: " + e.message); }
    finally { setGeneratingPaymentLink(false); }
  };
  const handleSendPaymentLink = async () => {
    setSendingPaymentLink(true);
    try {
      const result = await callApi("payments.createPaymentLink", {
        invoiceId: id,
        amount: invoice.total,
        description: "Invoice " + (invoice.invoice_number || id.slice(0, 8)),
      });
      if (result.url) {
        await callApi("notifications.sendEstimateSentEmail", {
          estimateId: invoice.estimate_id || "",
          customerEmail: invoice.customer_email || "",
          message: "You can pay your invoice online: " + result.url,
        });
        await callApi("invoices.updateInvoice", { id, payment_link_id: result.id });
        alert("Payment link sent! Customer can pay at: " + result.url);
      }
    } catch (e: any) { alert("Failed: " + e.message); }
    finally { setSendingPaymentLink(false); }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await callApi("invoices.updateInvoiceStatus", { id, status: newStatus });
      setStatus(newStatus);
      setInvoice((prev: any) => ({ ...prev, status: newStatus }));
    } catch (e: any) { alert("Failed: " + e.message); }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      paid: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
      sent: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
      overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
      draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    };
    return map[s] || map.draft;
  };

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center flex-col gap-4"><p className="text-red-500">{error}</p><Link to="/invoices" className="text-indigo-600 hover:underline">← Back to Invoices</Link></div>;
  if (!user || !invoice) return null;

  const canEdit = status === "draft";

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link to="/invoices" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">← Invoices</Link>
            <h1 className="text-2xl font-bold tracking-tight mt-1">Invoice {invoice.invoice_number}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{invoice.project_name} — {invoice.customer_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={e => handleStatusChange(e.target.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize border ${statusBadge(status)} cursor-pointer`}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={handleGeneratePdf} disabled={generatingPdf} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {generatingPdf ? "Generating..." : pdfBase64 ? "Regenerate PDF" : "Generate PDF"}
          </button>
          {pdfBase64 && (
            <button onClick={() => handleDownloadPdf(pdfBase64, invoice.invoice_number)} className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950">
              Download PDF
            </button>
          )}
          {status !== "paid" && (
            <div className="flex gap-2">
              <button onClick={handlePayNow} disabled={generatingPaymentLink} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {generatingPaymentLink ? "Generating..." : "Pay Now"}
              </button>
              <button onClick={handleSendPaymentLink} disabled={sendingPaymentLink} className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950 disabled:opacity-50">
                {sendingPaymentLink ? "Sending..." : "Send Payment Link"}
              </button>
              <button onClick={handleSendReminder} disabled={sendingReminder} className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950 disabled:opacity-50">
                {sendingReminder ? "Sending..." : "Send Reminder"}
              </button>
            </div>
          )}
          <Link to="/estimates/$id" params={{ id: invoice.estimate_id }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
            View Estimate
          </Link>
        </div>

        {/* Details grid */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Invoice Info */}
          <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800 md:col-span-1">
            <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider mb-3">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span>{invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : "—"}</span>
              </div>
              <div className="flex justify-between items-center group">
                <span className="text-gray-500">Due Date</span>
                {editingNotes ? (
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    onBlur={() => { handleSaveField("dueDate", dueDate); setEditingNotes(false); }}
                    className="rounded border border-gray-300 px-2 py-0.5 text-sm w-36 dark:border-gray-700 dark:bg-gray-800" />
                ) : (
                  <span onClick={() => canEdit && setEditingNotes(true)} className={canEdit ? "cursor-pointer hover:text-indigo-600" : ""}>{dueDate || "—"}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge(status)}`}>{status}</span>
              </div>
              {invoice.paid_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Paid</span>
                  <span>{new Date(invoice.paid_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tax & Discount */}
          <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800 md:col-span-1">
            <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider mb-3">Tax & Discount</h3>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2 items-center">
                <label className="text-gray-500 w-20">Tax Rate</label>
                <input type="number" min="0" max="100" step="0.01" value={taxRate}
                  onChange={e => setTaxRate(e.target.value)}
                  onBlur={() => handleSaveField("taxRate", parseFloat(taxRate) || 0)}
                  disabled={!canEdit}
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 disabled:opacity-50" />
                <span className="text-gray-400">%</span>
              </div>
              <div className="flex gap-2 items-center">
                <label className="text-gray-500 w-20">Discount</label>
                <select value={discountType} onChange={e => { setDiscountType(e.target.value); handleSaveField("discountType", e.target.value); }}
                  disabled={!canEdit}
                  className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 disabled:opacity-50">
                  <option value="">None</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed</option>
                </select>
                {discountType && (
                  <>
                    <input type="number" min="0" step="0.01" value={discountValue}
                      onChange={e => setDiscountValue(e.target.value)}
                      onBlur={() => handleSaveField("discountValue", parseFloat(discountValue) || 0)}
                      disabled={!canEdit}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 disabled:opacity-50" />
                    <span className="text-gray-400">{discountType === "percentage" ? "%" : "$"}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800 md:col-span-1">
            <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider mb-3">Totals</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>${Number(invoice.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              {invoice.discount_type && (invoice.discount_value > 0) && (
                <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="text-red-600">-${Number(invoice.discount_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              )}
              {invoice.tax_rate > 0 && (
                <div className="flex justify-between"><span className="text-gray-500">Tax ({invoice.tax_rate}%)</span><span>${Number(invoice.tax_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              )}
              <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span>${Number(invoice.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">Line Items</h3>
            {canEdit && (
              <button onClick={() => setEditingItems(!editingItems)} className="text-xs font-medium text-indigo-600 hover:text-indigo-500">
                {editingItems ? "Cancel Editing" : "Edit Items"}
              </button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-950">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Description</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500 w-16">Qty</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 w-20">Unit</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500 w-24">Rate</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500 w-16">Markup</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500 w-24">Total</th>
                {editingItems && <th className="px-4 py-2 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {(editingItems ? editItems : items).map((it: any, i: number) => {
                const lineTotal = (it.quantity || 1) * (it.unit_cost || 0) * (1 + (it.markup_percent || 0) / 100);
                return (
                  <tr key={it.id || i} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                    <td className="px-4 py-2">
                      {editingItems ? (
                        <input value={it.description} onChange={e => {
                          const copy = [...editItems]; copy[i] = { ...copy[i], description: e.target.value, _changed: true }; setEditItems(copy);
                        }} className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" />
                      ) : it.description}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {editingItems ? (
                        <input type="number" value={it.quantity} onChange={e => {
                          const copy = [...editItems]; copy[i] = { ...copy[i], quantity: parseFloat(e.target.value) || 0, _changed: true }; setEditItems(copy);
                        }} className="w-full text-right rounded border border-gray-300 px-1 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" />
                      ) : it.quantity}
                    </td>
                    <td className="px-4 py-2">
                      {editingItems ? (
                        <input value={it.unit} onChange={e => {
                          const copy = [...editItems]; copy[i] = { ...copy[i], unit: e.target.value, _changed: true }; setEditItems(copy);
                        }} className="w-full rounded border border-gray-300 px-1 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" />
                      ) : it.unit}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {editingItems ? (
                        <input type="number" step="0.01" value={it.unit_cost} onChange={e => {
                          const copy = [...editItems]; copy[i] = { ...copy[i], unit_cost: parseFloat(e.target.value) || 0, _changed: true }; setEditItems(copy);
                        }} className="w-full text-right rounded border border-gray-300 px-1 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" />
                      ) : `$${Number(it.unit_cost || 0).toFixed(2)}`}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {editingItems ? (
                        <input type="number" step="0.1" value={it.markup_percent} onChange={e => {
                          const copy = [...editItems]; copy[i] = { ...copy[i], markup_percent: parseFloat(e.target.value) || 0, _changed: true }; setEditItems(copy);
                        }} className="w-full text-right rounded border border-gray-300 px-1 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" />
                      ) : `${it.markup_percent || 0}%`}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    {editingItems && (
                      <td className="px-1">
                        <button onClick={() => setEditItems(editItems.filter((_: any, j: number) => j !== i))} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={editingItems ? 7 : 6} className="px-4 py-8 text-center text-gray-400">No line items</td></tr>
              )}
            </tbody>
          </table>
          {editingItems && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex gap-2">
              <button onClick={() => {
                setEditItems([...editItems, { id: "new-" + Date.now(), description: "", quantity: 1, unit: "each", unit_cost: 0, markup_percent: 0, sort_order: editItems.length, _changed: true }]);
              }} className="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-900">
                + Add Item
              </button>
              <button onClick={handleRecalcAndSave} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                Save & Recalculate
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="mt-6 rounded-xl border border-gray-200 p-5 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">Notes</h3>
            {canEdit && (
              <button onClick={() => { setEditingNotes(!editingNotes); if (!editingNotes) setNotes(invoice.notes || ""); else handleSaveField("notes", notes); }}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-500">
                {editingNotes ? "Save" : "Edit"}
              </button>
            )}
          </div>
          {editingNotes ? (
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" rows={3}
              placeholder="Payment terms, notes..." />
          ) : (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{invoice.notes || "No notes"}</p>
          )}
        </div>

        {/* Reminders */}
        {reminders.length > 0 && (
          <div className="mt-6 rounded-xl border border-gray-200 p-5 dark:border-gray-800">
            <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider mb-3">Reminders Sent</h3>
            <div className="space-y-2 text-sm">
              {reminders.map((r: any) => (
                <div key={r.id} className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Sent to: {r.sent_to}</span>
                  <span>{new Date(r.sent_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
