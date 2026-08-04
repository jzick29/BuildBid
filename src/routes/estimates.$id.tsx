import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { SignaturePad } from "~/components/SignaturePad";

export const Route = createFileRoute("/estimates/$id")({
  loader: async () => ({}),
  component: EstimateDetail,
});

function EstimateDetail() {
  const router = useRouter();
  const params = Route.useParams();
  const id = params.id;
  if (!id) return null;
  const [user, setUser] = useState<any>(null);
  const [estimate, setEstimate] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [taxRate, setTaxRate] = useState(0);
  const [savingTax, setSavingTax] = useState(false);
  const [markupPresets, setMarkupPresets] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);

  const [newDesc, setNewDesc] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newUnit, setNewUnit] = useState("each");
  const [newCost, setNewCost] = useState("0");
  const [newMarkup, setNewMarkup] = useState("0");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const [proposalTerms, setProposalTerms] = useState("");
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [proposals, setProposals] = useState<any[]>([]);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [signature, setSignature] = useState<any>(null);
  const [savingSignature, setSavingSignature] = useState(false);
  // Time tracking
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [timeSummary, setTimeSummary] = useState<any>(null);
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [timeDesc, setTimeDesc] = useState("");
  const [timeHours, setTimeHours] = useState("");
  const [timeCrew, setTimeCrew] = useState("");
  const [timeDate, setTimeDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingTime, setSavingTime] = useState(false);
  // Expense tracking
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<any>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("materials");
  const [expenseVendor, setExpenseVendor] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseNotes, setExpenseNotes] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [signedByName, setSignedByName] = useState("");

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "estimates.getEstimate", args: { data: { id } } }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setEstimate(d.estimate);
      setLineItems(d.lineItems);
      setTaxRate(parseFloat(d.estimate.tax_rate) || 0);
    } catch (e: any) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!d.user) { window.location.href = "/login"; return; }
        setUser(d.user);
        return Promise.all([
          loadData(),
          fetch("/api/call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ function: "markups.listPresets", args: {} }),
            credentials: "include",
          }).then(r => r.json()),
          fetch("/api/call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ function: "estimates.getVersions", args: { data: { estimateId: id } } }),
            credentials: "include",
          }).then(r => r.json()),
          fetch("/api/call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ function: "proposals.getProposals", args: { data: { estimateId: id } } }),
            credentials: "include",
          }).then(r => r.json()),
          fetch("/api/call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ function: "timeEntries.listTimeEntries", args: { data: { estimateId: id } } }),
            credentials: "include",
          }).then(r => r.json()),
          fetch("/api/call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ function: "timeEntries.getTimeSummary", args: { data: { estimateId: id } } }),
            credentials: "include",
          }).then(r => r.json()),
          fetch("/api/call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ function: "expenses.listExpenses", args: { data: { estimateId: id } } }),
            credentials: "include",
          }).then(r => r.json()),
          fetch("/api/call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ function: "expenses.getExpenseSummary", args: { data: { estimateId: id } } }),
            credentials: "include",
          }).then(r => r.json()),
        ]);
      })
      .then(([_est, mpData, verData, propData, teData, tsData, expData, expSumData]) => {
        if (mpData?.presets) setMarkupPresets(mpData.presets);
        if (verData?.versions) setVersions(verData.versions);
        if (propData?.proposals) setProposals(propData.proposals);
        if (teData?.timeEntries) setTimeEntries(teData.timeEntries);
        if (tsData) setTimeSummary(tsData);
        if (expData?.expenses) setExpenses(expData.expenses);
        if (expSumData) setExpenseSummary(expSumData);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, loadData]);

  const handleTaxSave = async () => {
    setSavingTax(true);
    await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "estimates.updateTaxRate", args: { data: { id, taxRate } } }),
      credentials: "include",
    });
    setSavingTax(false);
  };

  const updateQty = async (lineId: string, qty: number) => {
    setLineItems(prev => prev.map(li => li.id === lineId ? { ...li, quantity: qty } : li));
    await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "estimates.updateLineItemQty", args: { data: { id: lineId, quantity: qty } } }),
      credentials: "include",
    });
  };

  const updateCost = async (lineId: string, cost: number) => {
    setLineItems(prev => prev.map(li => li.id === lineId ? { ...li, unit_cost: cost } : li));
    await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "estimates.updateLineItemCost", args: { data: { id: lineId, unitCost: cost } } }),
      credentials: "include",
    });
  };

  const updateMarkup = async (lineId: string, markupPercent: number) => {
    setLineItems(prev => prev.map(li => li.id === lineId ? { ...li, markup_percent: markupPercent } : li));
    await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "estimates.updateLineItemMarkup", args: { data: { id: lineId, markupPercent } } }),
      credentials: "include",
    });
  };

  const removeLineItem = async (lineId: string) => {
    setLineItems(prev => prev.filter(li => li.id !== lineId));
    await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "estimates.removeLineItem", args: { data: { id: lineId } } }),
      credentials: "include",
    });
  };

  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim()) { setAddError("Description required"); return; }
    setAddError(""); setAdding(true);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: "estimates.addLineItem",
          args: { data: { estimateId: id, description: newDesc.trim(), quantity: parseFloat(newQty) || 1, unit: newUnit, unitCost: parseFloat(newCost) || 0, markupPercent: parseFloat(newMarkup) || 0 } },
        }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setNewDesc(""); setNewQty("1"); setNewUnit("each"); setNewCost("0"); setNewMarkup("0");
      await loadData();
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleSaveSignature = async (dataUrl: string) => {
    setSavingSignature(true);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: "signatures.saveSignature",
          args: { data: { estimateId: id, signatureData: dataUrl, signedByName } },
        }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      // Refresh signature
      const sRes = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "signatures.getSignature", args: { data: { estimateId: id } } }),
        credentials: "include",
      });
      const sData = await sRes.json();
      if (sData?.signature) setSignature(sData.signature);
    } catch (e: any) {
      alert("Failed to save signature: " + (e.message || "Unknown error"));
    } finally {
      setSavingSignature(false);
    }
  };

  const handleCreateTimeEntry = async () => {
    if (!timeHours || parseFloat(timeHours) <= 0) return;
    setSavingTime(true);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: "timeEntries.createTimeEntry",
          args: { data: { estimateId: id, description: timeDesc, hours: parseFloat(timeHours), crewMember: timeCrew, date: timeDate } },
        }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setTimeDesc(""); setTimeHours(""); setTimeCrew("");
      setTimeDate(new Date().toISOString().slice(0, 10));
      setShowTimeForm(false);
      // Refresh
      const [entriesRes, summaryRes] = await Promise.all([
        fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "timeEntries.listTimeEntries", args: { data: { estimateId: id } } }), credentials: "include" }).then(r => r.json()),
        fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "timeEntries.getTimeSummary", args: { data: { estimateId: id } } }), credentials: "include" }).then(r => r.json()),
      ]);
      if (entriesRes?.timeEntries) setTimeEntries(entriesRes.timeEntries);
      if (summaryRes) setTimeSummary(summaryRes);
    } catch (e: any) {
      alert("Failed: " + (e.message || "Unknown error"));
    } finally { setSavingTime(false); }
  };

  const handleDeleteTimeEntry = async (entryId: string) => {
    if (!confirm("Delete this time entry?")) return;
    await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "timeEntries.deleteTimeEntry", args: { data: { id: entryId } } }),
      credentials: "include",
    });
    setTimeEntries(prev => prev.filter(e => e.id !== entryId));
    // Refresh summary
    fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "timeEntries.getTimeSummary", args: { data: { estimateId: id } } }),
      credentials: "include",
    }).then(r => r.json()).then(d => { if (d) setTimeSummary(d); });
  };

  const handleCreateExpense = async () => {
    if (!expenseAmount || parseFloat(expenseAmount) <= 0) return;
    setSavingExpense(true);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: "expenses.createExpense",
          args: { data: { estimateId: id, description: expenseDesc, amount: parseFloat(expenseAmount), category: expenseCategory, vendor: expenseVendor, expenseDate, notes: expenseNotes } },
        }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setExpenseDesc(""); setExpenseAmount(""); setExpenseCategory("materials"); setExpenseVendor("");
      setExpenseDate(new Date().toISOString().slice(0, 10)); setExpenseNotes("");
      setShowExpenseForm(false);
      // Refresh
      const [expRes, sumRes] = await Promise.all([
        fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "expenses.listExpenses", args: { data: { estimateId: id } } }), credentials: "include" }).then(r => r.json()),
        fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "expenses.getExpenseSummary", args: { data: { estimateId: id } } }), credentials: "include" }).then(r => r.json()),
      ]);
      if (expRes?.expenses) setExpenses(expRes.expenses);
      if (sumRes) setExpenseSummary(sumRes);
    } catch (e: any) {
      alert("Failed: " + (e.message || "Unknown error"));
    } finally { setSavingExpense(false); }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Delete this expense?")) return;
    await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "expenses.deleteExpense", args: { data: { id: expenseId } } }),
      credentials: "include",
    });
    setExpenses(prev => prev.filter(e => e.id !== expenseId));
    // Refresh summary
    fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "expenses.getExpenseSummary", args: { data: { estimateId: id } } }),
      credentials: "include",
    }).then(r => r.json()).then(d => { if (d) setExpenseSummary(d); });
  };

  const handleSaveVersion = async () => {
    setSavingVersion(true);
    const res = await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "estimates.saveVersion", args: { data: { estimateId: id } } }),
      credentials: "include",
    });
    const d = await res.json();
    if (d.versionNumber) {
      const vRes = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "estimates.getVersions", args: { data: { estimateId: id } } }),
        credentials: "include",
      });
      const vData = await vRes.json();
      if (vData?.versions) setVersions(vData.versions);
    }
    setSavingVersion(false);
  };

  const handleSaveAsTemplate = async () => {
    if (!saveTemplateName.trim()) return;
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "templates.saveCustomTemplate", args: { data: { estimateId: id, name: saveTemplateName.trim() } } }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setShowSaveTemplate(false);
      setSaveTemplateName("");
    } catch (e: any) { alert("Failed: " + (e.message || "Unknown error")); }
    finally { setSavingTemplate(false); }
  };

  const handleGenerateProposal = async () => {
    setGeneratingProposal(true);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: "proposals.generateProposal",
          args: { data: { estimateId: id, terms: proposalTerms, signatureDataUrl: signature?.signature_data } },
        }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      const pRes = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "proposals.getProposals", args: { data: { estimateId: id } } }),
        credentials: "include",
      });
      const pData = await pRes.json();
      if (pData?.proposals) setProposals(pData.proposals);
      setShowProposalForm(false);
      setProposalTerms("");
      if (d.pdfBase64) {
        const link = document.createElement("a");
        link.href = "data:application/pdf;base64," + d.pdfBase64;
        link.download = (d.proposalNumber || "proposal") + ".pdf";
        link.click();
      }
    } catch (e: any) {
      alert("Failed to generate proposal: " + (e.message || "Unknown error"));
    } finally {
      setGeneratingProposal(false);
    }
  };

  const handleDownloadProposal = async (proposalId: string) => {
    const res = await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "proposals.getProposal", args: { data: { id: proposalId } } }),
      credentials: "include",
    });
    const d = await res.json();
    if (d.proposal?.pdf_data) {
      const link = document.createElement("a");
      link.href = "data:application/pdf;base64," + d.proposal.pdf_data;
      link.download = (d.proposal.proposal_number || "proposal") + ".pdf";
      link.click();
    }
  };

  const applyPreset = (preset: any) => {
    if (lineItems.length === 0) return;
    setLineItems(prev => prev.map(li => ({ ...li, markup_percent: preset.markup_percent })));
    lineItems.forEach(li => {
      fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "estimates.updateLineItemMarkup", args: { data: { id: li.id, markupPercent: preset.markup_percent } } }),
        credentials: "include",
      });
    });
  };

  const subtotal = lineItems.reduce((s: number, li: any) => s + (li.quantity * li.unit_cost), 0);
  const afterMarkup = lineItems.reduce((s: number, li: any) => {
    const lineBase = li.quantity * li.unit_cost;
    return s + lineBase * (1 + (li.markup_percent || 0) / 100);
  }, 0);
  const taxAmount = afterMarkup * (taxRate / 100);
  const grandTotal = afterMarkup + taxAmount;

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">{error}</p></div>;
  if (!user || !estimate) return null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link to="/estimates" className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">&larr; Back to estimates</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{estimate.project_name}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            <span className="capitalize">{estimate.trade}</span> &middot; Customer: {estimate.customer_name} &middot; Status:{" "}
            <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + (
              estimate.status === "won" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" :
              estimate.status === "lost" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" :
              estimate.status === "sent" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" :
              "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
            )}>{estimate.status}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleSaveVersion} disabled={savingVersion} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
            {savingVersion ? "Saving..." : "Save Version"}
          </button>
          <button onClick={() => setShowSaveTemplate(true)} className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950">
            Save as Template
          </button>
          <button onClick={() => setShowProposalForm(!showProposalForm)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Generate Proposal
          </button>
        </div>
      </div>

      {showProposalForm && (
        <div className="mt-6 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
          <h3 className="font-semibold text-lg mb-4">Generate Proposal</h3>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Terms &amp; Notes (optional)</label>
            <textarea value={proposalTerms} onChange={e => setProposalTerms(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800" placeholder="Payment due within 30 days..." />
          </div>
          <button onClick={handleGenerateProposal} disabled={generatingProposal} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {generatingProposal ? "Generating..." : "Generate & Download PDF"}
          </button>
        </div>
      )}

      {proposals.length > 0 && (
        <div className="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Previous Proposals</h3>
          <div className="mt-2 space-y-2">
            {proposals.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{p.proposal_number} &mdash; {new Date(p.created_at).toLocaleDateString()}</span>
                <button onClick={() => handleDownloadProposal(p.id)} className="text-indigo-600 hover:text-indigo-500 font-medium">Download</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Signature Section */}
      <div className="mt-6 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
        <h3 className="font-semibold text-lg mb-2">Signature</h3>
        {signature ? (
          <div>
            <SignaturePad
              existingSignature={signature.signature_data}
              readOnly={true}
              width={500}
              height={200}
              onSave={() => {}}
            />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Signed by <strong>{signature.signed_by_name || "Customer"}</strong> on{" "}
              {new Date(signature.signed_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              Have your customer sign directly on the screen.
            </p>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Signer Name
              </label>
              <input
                type="text"
                value={signedByName}
                onChange={e => setSignedByName(e.target.value)}
                placeholder="Customer name"
                className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
            <SignaturePad
              onSave={handleSaveSignature}
              onClear={() => setSignature(null)}
              width={500}
              height={200}
            />
            {savingSignature && (
              <p className="mt-2 text-xs text-gray-500">Saving signature...</p>
            )}
          </div>
        )}
      </div>
      {/* Time Tracking Section */}
      <div className="mt-6 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Time Tracking</h3>
          <button onClick={() => setShowTimeForm(!showTimeForm)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
            {showTimeForm ? "Cancel" : "Log Hours"}
          </button>
        </div>
        {timeSummary && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-indigo-50 p-3 dark:bg-indigo-950/30">
              <p className="text-xs text-gray-500 dark:text-gray-400">Actual Hours</p>
              <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{timeSummary.totalHours.toFixed(1)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
              <p className="text-xs text-gray-500 dark:text-gray-400">Entries</p>
              <p className="text-xl font-bold text-gray-700 dark:text-gray-300">{timeSummary.entryCount}</p>
            </div>
          </div>
        )}
        {showTimeForm && (
          <div className="mb-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Hours</label>
                <input type="number" value={timeHours} onChange={e => setTimeHours(e.target.value)} step="0.5" min="0" placeholder="2.5" className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Date</label>
                <input type="date" value={timeDate} onChange={e => setTimeDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Crew Member</label>
              <input type="text" value={timeCrew} onChange={e => setTimeCrew(e.target.value)} placeholder="Name" className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Description</label>
              <input type="text" value={timeDesc} onChange={e => setTimeDesc(e.target.value)} placeholder="What was done" className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <button onClick={handleCreateTimeEntry} disabled={savingTime || !timeHours} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {savingTime ? "Saving..." : "Log Hours"}
            </button>
          </div>
        )}
        {timeEntries.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Crew</th>
                  <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Description</th>
                  <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400 text-right">Hours</th>
                  <th className="px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {timeEntries.map((e: any) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{new Date(e.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{e.crew_member || "\u2014"}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{e.description || "\u2014"}</td>
                    <td className="px-3 py-2 text-right font-medium">{Number(e.hours).toFixed(1)}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => handleDeleteTimeEntry(e.id)} className="text-xs text-red-600 hover:text-red-500">Del</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">No time entries logged yet.</p>
        )}
      </div>

      {/* Expense Tracking Section */}
      <div className="mt-6 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Expense Tracking</h3>
          <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
            {showExpenseForm ? "Cancel" : "Add Expense"}
          </button>
        </div>
        {expenseSummary && (
          <div className="mb-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                <p className="text-xs text-gray-500 dark:text-gray-400">Est. Total</p>
                <p className="text-lg font-bold text-gray-700 dark:text-gray-300">${expenseSummary.estimatedTotal.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
                <p className="text-xs text-gray-500 dark:text-gray-400">Actual</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${expenseSummary.totalExpenses.toFixed(2)}</p>
              </div>
              <div className={`rounded-lg p-3 ${expenseSummary.variance >= 0 ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                <p className="text-xs text-gray-500 dark:text-gray-400">{expenseSummary.variance >= 0 ? 'Under' : 'Over'} Budget</p>
                <p className={`text-lg font-bold ${expenseSummary.variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  ${Math.abs(expenseSummary.variance).toFixed(2)}
                </p>
              </div>
            </div>
            {expenseSummary.byCategory?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {expenseSummary.byCategory.map((c: any) => (
                  <span key={c.category} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {c.category}: ${c.total.toFixed(2)} ({c.count})
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {showExpenseForm && (
          <div className="mb-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Amount ($)</label>
                <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Category</label>
                <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800">
                  <option value="materials">Materials</option>
                  <option value="labor">Labor</option>
                  <option value="equipment">Equipment</option>
                  <option value="permits">Permits</option>
                  <option value="subcontractor">Subcontractor</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Vendor</label>
                <input type="text" value={expenseVendor} onChange={e => setExpenseVendor(e.target.value)} placeholder="Supplier name" className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Date</label>
                <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Description</label>
              <input type="text" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} placeholder="What was purchased" className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Notes</label>
              <input type="text" value={expenseNotes} onChange={e => setExpenseNotes(e.target.value)} placeholder="Optional notes" className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <button onClick={handleCreateExpense} disabled={savingExpense || !expenseAmount} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {savingExpense ? "Saving..." : "Add Expense"}
            </button>
          </div>
        )}
        {expenses.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Category</th>
                  <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Description</th>
                  <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Vendor</th>
                  <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400 text-right">Amount</th>
                  <th className="px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {expenses.map((e: any) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{new Date(e.expense_date).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200 max-w-[200px] truncate">{e.description || "\u2014"}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{e.vendor || "\u2014"}</td>
                    <td className="px-3 py-2 text-right font-medium">${Number(e.amount).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => handleDeleteExpense(e.id)} className="text-xs text-red-600 hover:text-red-500">Del</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">No expenses logged yet.</p>
        )}
      </div>
      <div className="mt-6 flex items-center gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tax Rate (%):</label>
        <input
          type="number"
          value={taxRate || ""}
          onChange={e => { setTaxRate(parseFloat(e.target.value) || 0); }}
          onBlur={handleTaxSave}
          placeholder="0"
          step="0.01"
          className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
        />
        {savingTax && <span className="text-xs text-gray-500">Saving...</span>}
      </div>

      {markupPresets.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Presets:</span>
          {markupPresets.map((mp: any) => (
            <button key={mp.id} onClick={() => applyPreset(mp)} className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-indigo-950">
              {mp.name} ({mp.markup_percent}%)
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-950">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Description</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-20">Qty</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-24">Unit</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">Unit Cost</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-24">Markup %</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28 text-right">Total</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {lineItems.map((li: any) => {
              const lineTotal = (li.quantity * li.unit_cost) * (1 + (li.markup_percent || 0) / 100);
              return (
                <tr key={li.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                  <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{li.description}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={li.quantity || ""}
                      onChange={e => updateQty(li.id, parseFloat(e.target.value) || 1)}
                      className="w-16 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
                    />
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{li.unit}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={li.unit_cost || ""}
                      onChange={e => updateCost(li.id, parseFloat(e.target.value) || 0)}
                      step="0.01"
                      className="w-24 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={li.markup_percent || ""}
                        onChange={e => updateMarkup(li.id, parseFloat(e.target.value) || 0)}
                        className="w-16 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
                      />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-medium">${lineTotal.toFixed(2)}</td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => removeLineItem(li.id)} className="text-xs text-red-500 hover:text-red-400">&times;</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <div className="w-72 space-y-2 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">After Markup</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">${afterMarkup.toFixed(2)}</span>
          </div>
          {taxRate > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Tax ({taxRate}%)</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">${taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span className="text-gray-900 dark:text-gray-100">Grand Total</span>
            <span className="text-indigo-600 dark:text-indigo-400">${grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-gray-300 p-6 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Add Line Item</h3>
        {addError && <p className="mb-3 text-sm text-red-500">{addError}</p>}
        <form onSubmit={handleAddLine} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description" className="sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          <input type="number" value={newQty} onChange={e => setNewQty(e.target.value)} placeholder="Qty" className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          <select value={newUnit} onChange={e => setNewUnit(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
            <option value="each">each</option>
            <option value="hour">hour</option>
            <option value="foot">foot</option>
            <option value="sqft">sq ft</option>
            <option value="lump">lump sum</option>
          </select>
          <input type="number" value={newCost} onChange={e => setNewCost(e.target.value)} placeholder="Unit Cost" step="0.01" className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          <div className="flex items-center gap-1">
            <input type="number" value={newMarkup} onChange={e => setNewMarkup(e.target.value)} placeholder="Markup %" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            <button type="submit" disabled={adding} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap">
              {adding ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8">
        <button
          onClick={() => setShowVersions(!showVersions)}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          {showVersions ? "Hide" : "Show"} Version History ({versions.length})
        </button>
        {showVersions && (
          <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            {versions.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-500">No versions saved yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-950">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Version</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {versions.map((v: any) => (
                    <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-950">
                      <td className="px-4 py-2 text-gray-800 dark:text-gray-200">v{v.version_number}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{new Date(v.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
