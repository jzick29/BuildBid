import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/contracts/$id")({
  loader: async () => ({}),
  component: ContractDetail,
});

const FREQ_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  "semi-annual": "Semi-Annual",
  annual: "Annual",
};

function ContractDetail() {
  const router = useRouter();
  const params = Route.useParams();
  const [contract, setContract] = useState<any>(null);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Log Visit form
  const [showLogVisit, setShowLogVisit] = useState(false);
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [logNotes, setLogNotes] = useState("");
  const [logSaving, setLogSaving] = useState(false);

  const fetchData = async () => {
    try {
      const d = await fetch("/api/call", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "contracts.getContract", args: { data: { id: params.id } } }),
        credentials: "include",
      }).then(r => r.json());
      setContract(d);
      if (d?.visits) setVisits(d.visits || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [params.id]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "contracts.generateNextVisit", args: { data: { contractId: contract.id } } }), credentials: "include" }).then(r => r.json());
      fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setGenerating(false); }
  };

  const handleComplete = async (visitId: string) => {
    setCompleting(visitId);
    try {
      await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "contracts.completeVisit", args: { data: { visitId } } }), credentials: "include" });
      fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setCompleting(null); }
  };

  const handleStatus = async (status: string) => {
    await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "contracts.updateContractStatus", args: { data: { id: contract.id, status } } }), credentials: "include" });
    fetchData();
  };

  const handleLogVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogSaving(true);
    try {
      await fetch("/api/call", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "contracts.logVisit", args: { data: { contractId: contract.id, date: logDate, notes: logNotes, status: "completed" } } }),
        credentials: "include",
      });
      setShowLogVisit(false);
      setLogNotes("");
      setLogDate(new Date().toISOString().split("T")[0]);
      fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setLogSaving(false); }
  };

  if (loading) return <div className="max-w-3xl mx-auto p-6"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="max-w-3xl mx-auto p-6"><p className="text-red-500">{error}</p></div>;
  if (!contract) return <div className="max-w-3xl mx-auto p-6"><p className="text-gray-500">Contract not found</p></div>;

  const isExpired = contract.status === "expired";

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link to="/contracts" className="text-sm text-indigo-600 hover:text-indigo-500">&larr; Back to Contracts</Link>
      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{contract.project_name}</h1>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          contract.status === "active" ? "bg-green-100 text-green-800" :
          contract.status === "expired" ? "bg-red-100 text-red-800" :
          "bg-gray-100 text-gray-800"
        }`}>{contract.status}</span>
      </div>

      {/* Next Visit — Prominent */}
      {contract.next_visit_date && (
        <div className="mt-4 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-800 dark:bg-indigo-950/30">
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Next Visit</p>
          <p className="mt-1 text-2xl font-bold text-indigo-800 dark:text-indigo-200">{new Date(contract.next_visit_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500">Customer</p>
          <p className="font-medium">{contract.customer_name}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500">Trade</p>
          <p className="font-medium capitalize">{contract.trade}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500">Frequency</p>
          <p className="font-medium">{FREQ_LABELS[contract.frequency] || contract.frequency}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500">Amount per Visit</p>
          <p className="font-medium">${(contract.amount || 0).toLocaleString("en-US", {minimumFractionDigits:2})}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500">Start Date</p>
          <p className="font-medium">{contract.start_date}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500">Next Visit</p>
          <p className="font-medium">{contract.next_visit_date || "Not scheduled"}</p>
        </div>
        {contract.end_date && (
          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500">End Date</p>
            <p className="font-medium">{contract.end_date}</p>
          </div>
        )}
      </div>
      {contract.scope_of_work && (
        <div className="mt-4 border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Scope of Work</p>
          <p className="text-sm whitespace-pre-wrap">{contract.scope_of_work}</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex gap-3 flex-wrap">
        {contract.status === "active" && (
          <>
            <button onClick={handleGenerate} disabled={generating}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm">
              {generating ? "Generating..." : "Schedule Next Visit"}
            </button>
            <button onClick={() => setShowLogVisit(true)}
              className="px-4 py-2 border border-indigo-300 text-indigo-600 rounded-md hover:bg-indigo-50 text-sm">
              Log Visit
            </button>
            <button onClick={() => handleStatus("expired")}
              className="px-4 py-2 border rounded-md hover:bg-gray-50 text-sm">
              Mark Expired
            </button>
          </>
        )}
        {isExpired && (
          <>
            <button onClick={() => handleStatus("active")}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
              Renew Contract
            </button>
            <button onClick={() => setShowLogVisit(true)}
              className="px-4 py-2 border border-indigo-300 text-indigo-600 rounded-md hover:bg-indigo-50 text-sm">
              Log Visit
            </button>
          </>
        )}
        <button onClick={() => handleStatus("cancelled")}
          className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 text-sm">
          Cancel Contract
        </button>
      </div>

      {/* Log Visit Modal */}
      {showLogVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowLogVisit(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Log a Visit</h3>
            <form onSubmit={handleLogVisit} className="mt-4 space-y-4">
              <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label><input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" required /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label><textarea value={logNotes} onChange={e => setLogNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" placeholder="What was done on this visit?" /></div>
              <div className="flex gap-3">
                <button type="submit" disabled={logSaving} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{logSaving ? "Saving..." : "Save Visit"}</button>
                <button type="button" onClick={() => setShowLogVisit(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visit History — Timeline */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Visit History</h2>
        {visits.length === 0 ? (
          <p className="text-sm text-gray-400">No visits yet</p>
        ) : (
          <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-800 space-y-4">
            {visits.map((v: any) => {
              const isCompleted = v.status === "completed";
              return (
                <div key={v.id} className="relative">
                  <div className={`absolute -left-[25px] top-1 w-4 h-4 rounded-full border-2 ${isCompleted ? "bg-green-500 border-green-500" : "bg-gray-200 border-gray-300"}`}></div>
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{v.scheduled_date}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isCompleted ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{v.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {isCompleted ? `✓ Completed ${v.completed_at?.split("T")[0] || ""}` : "Scheduled"}
                    </p>
                    {v.notes && <p className="text-xs text-gray-400 mt-1">{v.notes}</p>}
                    {v.status === "scheduled" && (
                      <button onClick={() => handleComplete(v.id)} disabled={completing === v.id}
                        className="mt-2 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                        {completing === v.id ? "..." : "Complete"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
