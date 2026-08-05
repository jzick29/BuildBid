import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
export const Route = createFileRoute("/subcontractors")({ component: SubcontractorsPage });

const STATUS_STYLES: Record<string, string> = {
  open: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  awarded: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  closed: "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};
const QUOTE_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400",
  selected: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  declined: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};
const fmt = (n: any) => "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

function SubcontractorsPage() {
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", estimateId: "", scope: "", dueDate: "" });
  const [estimates, setEstimates] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ subcontractor: "", contact: "", email: "", phone: "", amount: "", timeline: "", notes: "" });
  const [quoteSaving, setQuoteSaving] = useState(false);

  const call = async (fn: string, data: any) => {
    const res = await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: fn, args: { data } }),
      credentials: "include",
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    return d;
  };

  const fetchData = async () => {
    try {
      const me = await fetch("/api/me", { credentials: "include" }).then(r => r.json());
      if (!me.user) { window.location.href = "/login"; return; }
      const d = await call("rfqs.list", {});
      setRfqs(d.rfqs || []);
      try { const e = await call("estimates.listEstimates", {}); setEstimates(e.estimates || []); } catch {}
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim()) return;
    setSaving(true);
    try {
      await call("rfqs.create", { title: createForm.title, estimateId: createForm.estimateId || undefined, scope: createForm.scope, dueDate: createForm.dueDate });
      setShowCreate(false);
      setCreateForm({ title: "", estimateId: "", scope: "", dueDate: "" });
      fetchData();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const openDetail = async (id: string) => {
    if (expanded === id) { setExpanded(null); setDetail(null); return; }
    setExpanded(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await call("rfqs.get", { rfqId: id });
      setDetail(d);
    } catch (err: any) { alert(err.message); }
    finally { setDetailLoading(false); }
  };

  const setStatus = async (rfqId: string, status: string) => {
    try { await call("rfqs.updateStatus", { rfqId, status }); if (expanded === rfqId) openDetail(rfqId); fetchData(); }
    catch (err: any) { alert(err.message); }
  };

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expanded || !quoteForm.subcontractor.trim() || !Number(quoteForm.amount)) return;
    setQuoteSaving(true);
    try {
      await call("rfqs.addQuote", { rfqId: expanded, subcontractor: quoteForm.subcontractor, contact: quoteForm.contact, email: quoteForm.email, phone: quoteForm.phone, amount: Number(quoteForm.amount), timeline: quoteForm.timeline, notes: quoteForm.notes });
      setQuoteForm({ subcontractor: "", contact: "", email: "", phone: "", amount: "", timeline: "", notes: "" });
      openDetail(expanded);
      fetchData();
    } catch (err: any) { alert(err.message); }
    finally { setQuoteSaving(false); }
  };

  const setQuoteStatus = async (quoteId: string, status: string) => {
    try { await call("rfqs.updateQuoteStatus", { quoteId, status }); if (expanded) openDetail(expanded); fetchData(); }
    catch (err: any) { alert(err.message); }
  };

  const deleteQuote = async (quoteId: string) => {
    if (!confirm("Delete this quote?")) return;
    try { await call("rfqs.deleteQuote", { quoteId }); if (expanded) openDetail(expanded); fetchData(); }
    catch (err: any) { alert(err.message); }
  };

  const bestAmount = detail?.quotes?.length ? Math.min(...detail.quotes.map((q: any) => Number(q.amount))) : null;
  const estimateTotal = detail?.estimate?.total ?? null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Subcontractor Bids</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Send RFQs, track quotes, and compare subcontractor bids side by side.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">New RFQ</button>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-gray-500">Loading…</p>
      ) : rfqs.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No RFQs yet. Create one to start collecting subcontractor bids.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rfqs.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <button onClick={() => openDetail(r.id)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-900">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-gray-900 dark:text-white">{r.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[r.status] || STATUS_STYLES.open}`}>{r.status}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {r.estimate_name ? <Link to="/estimates/$id" params={{ id: r.estimate_id }} className="text-indigo-600 dark:text-indigo-400 hover:underline">{r.estimate_name}</Link> : "No linked estimate"}
                    {r.due_date ? ` · Due ${r.due_date}` : ""} · {r.quote_count} quote{r.quote_count === 1 ? "" : "s"}
                    {r.lowest_quote != null && <span className="ml-1 font-medium text-green-600 dark:text-green-400">· low {fmt(r.lowest_quote)}</span>}
                  </p>
                </div>
                <span className="ml-3 text-xs text-gray-400">{expanded === r.id ? "▾" : "▸"}</span>
              </button>
              {expanded === r.id && (
                <div className="border-t border-gray-200 dark:border-gray-800">
                  {detailLoading ? (
                    <p className="px-4 py-4 text-sm text-gray-500">Loading…</p>
                  ) : detail && detail.rfq?.id === r.id ? (
                    <div className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">Status:</span>
                        {["open", "sent", "awarded", "closed"].map(s => (
                          <button key={s} onClick={() => setStatus(r.id, s)} className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${detail.rfq.status === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"}`}>{s}</button>
                        ))}
                      </div>
                      {detail.rfq.scope && <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{detail.rfq.scope}</p>}
                      {estimateTotal != null && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Linked estimate total: <b className="text-gray-800 dark:text-gray-200">{fmt(estimateTotal)}</b>
                          {bestAmount != null && <span className={`ml-2 ${bestAmount <= estimateTotal ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>best bid {fmt(bestAmount)} ({bestAmount <= estimateTotal ? "under" : "over"} estimate by {fmt(Math.abs(estimateTotal - bestAmount))})</span>}
                        </p>
                      )}

                      {detail.quotes.length > 0 ? (
                        <table className="mt-4 w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-950">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Subcontractor</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Contact</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Timeline</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {detail.quotes.map((q: any) => (
                              <tr key={q.id} className={q.status === "selected" ? "bg-green-50/60 dark:bg-green-950/20" : ""}>
                                <td className="px-3 py-2">
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {q.subcontractor}
                                    {Number(q.amount) === bestAmount && q.status !== "declined" && <span className="ml-2 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400">LOWEST</span>}
                                  </div>
                                  {q.notes && <p className="text-xs text-gray-500 dark:text-gray-400">{q.notes}</p>}
                                </td>
                                <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                                  {q.contact || "—"}<br />{q.email || q.phone || ""}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white">{fmt(q.amount)}</td>
                                <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{q.timeline || "—"}</td>
                                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${QUOTE_STYLES[q.status] || QUOTE_STYLES.pending}`}>{q.status}</span></td>
                                <td className="px-3 py-2">
                                  <div className="flex justify-end gap-1.5">
                                    {q.status !== "selected" && <button onClick={() => setQuoteStatus(q.id, "selected")} className="rounded-lg bg-green-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-green-700">Select</button>}
                                    {q.status === "selected" && <button onClick={() => setQuoteStatus(q.id, "pending")} className="rounded-lg bg-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300">Unselect</button>}
                                    {q.status !== "declined" && <button onClick={() => setQuoteStatus(q.id, "declined")} className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400">Decline</button>}
                                    <button onClick={() => deleteQuote(q.id)} className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400">✕</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="mt-4 text-sm text-gray-500">No quotes received yet. Add the first bid below.</p>
                      )}

                      <form onSubmit={handleAddQuote} className="mt-4 grid grid-cols-1 gap-2 rounded-lg border border-gray-200 dark:border-gray-800 p-3 sm:grid-cols-3">
                        <input required value={quoteForm.subcontractor} onChange={e => setQuoteForm({ ...quoteForm, subcontractor: e.target.value })} placeholder="Subcontractor name *" className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
                        <input value={quoteForm.contact} onChange={e => setQuoteForm({ ...quoteForm, contact: e.target.value })} placeholder="Contact person" className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
                        <input value={quoteForm.amount} onChange={e => setQuoteForm({ ...quoteForm, amount: e.target.value })} placeholder="Quote amount * ($)" type="number" step="0.01" min="0" required className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
                        <input value={quoteForm.email} onChange={e => setQuoteForm({ ...quoteForm, email: e.target.value })} placeholder="Email" className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
                        <input value={quoteForm.phone} onChange={e => setQuoteForm({ ...quoteForm, phone: e.target.value })} placeholder="Phone" className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
                        <input value={quoteForm.timeline} onChange={e => setQuoteForm({ ...quoteForm, timeline: e.target.value })} placeholder="Timeline (e.g. 3 weeks)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
                        <input value={quoteForm.notes} onChange={e => setQuoteForm({ ...quoteForm, notes: e.target.value })} placeholder="Scope / notes" className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 sm:col-span-2" />
                        <button type="submit" disabled={quoteSaving} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{quoteSaving ? "Adding…" : "Add Quote"}</button>
                      </form>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-950 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">New RFQ</h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <input required value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} placeholder="RFQ title (e.g. Electrical rough-in — Maple St.)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
              <select value={createForm.estimateId} onChange={e => setCreateForm({ ...createForm, estimateId: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950">
                <option value="">Link to estimate (optional)</option>
                {estimates.map((e: any) => <option key={e.id} value={e.id}>{e.project_name}</option>)}
              </select>
              <input value={createForm.dueDate} onChange={e => setCreateForm({ ...createForm, dueDate: e.target.value })} placeholder="Bid due date (optional)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
              <textarea value={createForm.scope} onChange={e => setCreateForm({ ...createForm, scope: e.target.value })} placeholder="Scope of work (optional)" rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? "Creating…" : "Create RFQ"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
