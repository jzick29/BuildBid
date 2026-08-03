import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/invoices/$id")({
  loader: async () => ({}),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const router = useRouter();
  const total = Number(invoice.total);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const handleStatus = async (status: string) => {
    await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "invoices.updateInvoiceStatus", args: { data: { id: invoice.id, status } } }), credentials: "include" });
    router.invalidate();
  };

  const handlePayNow = async () => {
    setCreatingPayment(true);
    try {
      const result = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "payments.createPaymentLink", args: { data: { invoiceId: invoice.id, amount: total, description: `Invoice #${invoice.invoice_number} — ${invoice.project_name}` } } }), credentials: "include" }).then(r => r.json());
      setPaymentUrl(result.url);
      window.open(result.url, "_blank");
    } catch (e: any) {
      alert("Stripe not configured. " + e.message);
    } finally {
      setCreatingPayment(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="text-xl font-bold text-indigo-600 dark:text-indigo-400">BuildBid</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/invoices" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Invoices</Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <Link to="/invoices" className="text-sm text-indigo-600 hover:text-indigo-500">&larr; Back to Invoices</Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Invoice #{invoice.invoice_number}</h1>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            invoice.status === "paid" ? "bg-green-100 text-green-800" :
            invoice.status === "sent" ? "bg-blue-100 text-blue-800" :
            "bg-gray-100 text-gray-800"
          }`}>
            {invoice.status}
          </span>
        </div>
        <div className="mt-6 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
          <div className="flex justify-between">
            <div>
              <p className="font-medium">{invoice.project_name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{invoice.customer_name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">Due: {invoice.due_date || "—"}</p>
              <p className="mt-1 text-2xl font-bold">${total.toLocaleString("en-US", {minimumFractionDigits:2})}</p>
              {invoice.paid_at && (
                <p className="text-xs text-green-600 mt-1">Paid {new Date(invoice.paid_at).toLocaleDateString()}</p>
              )}
            </div>
          </div>
          <div className="mt-6 space-y-2">
            {items.map((item: any) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.description} × {item.quantity} {item.unit}</span>
                <span className="font-medium">${(item.quantity * item.unit_cost * (1 + item.markup_percent / 100)).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3 flex-wrap">
            {invoice.status !== "paid" && (
              <>
                <button
                  onClick={handlePayNow}
                  disabled={creatingPayment}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {creatingPayment ? "Creating..." : "💳 Pay Now"}
                </button>
                {paymentUrl && (
                  <button
                    onClick={() => navigator.clipboard.writeText(paymentUrl!)}
                    className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Copy Payment Link
                  </button>
                )}
                <button
                  onClick={() => handleStatus("paid")}
                  className="rounded-lg border border-green-300 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
                >
                  Mark as Paid
                </button>
              </>
            )}
            {invoice.status === "draft" && (
              <button
                onClick={() => handleStatus("sent")}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Mark as Sent
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
