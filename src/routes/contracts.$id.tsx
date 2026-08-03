import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/contracts/$id")({
  loader: async ({ params }) => {
    const meRes = await fetch("http://localhost:3000/api/me"); const meData = await meRes.json(); const user = meData.user;
    if (!user) throw new Error("Unauthorized");
    const data = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "contracts.getContract", args: { data: { id: params.id } } }), credentials: "include" }).then(r => r.json());
    return { user, ...data };
  },
  component: ContractDetail,
});

const FREQ_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  "semi-annual": "Semi-Annual",
  annual: "Annual",
};

function ContractDetail() {
  const { user, contract, visits } = Route.useLoaderData();
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "contracts.generateNextVisit", args: { data: { contractId: contract.id } } }), credentials: "include" }).then(r => r.json());
      router.invalidate();
    } catch (e: any) { alert(e.message); }
    finally { setGenerating(false); }
  };

  const handleComplete = async (visitId: string) => {
    setCompleting(visitId);
    try {
      await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "contracts.completeVisit", args: { data: { visitId } } }), credentials: "include" });
      router.invalidate();
    } catch (e: any) { alert(e.message); }
    finally { setCompleting(null); }
  };

  const handleStatus = async (status: string) => {
    await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "contracts.updateContractStatus", args: { data: { id: contract.id, status } } }), credentials: "include" });
    router.invalidate();
  };

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
          <p className="font-medium">${contract.amount.toLocaleString("en-US", {minimumFractionDigits:2})}</p>
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

      <div className="mt-6 flex gap-3 flex-wrap">
        {contract.status === "active" && (
          <>
            <button onClick={handleGenerate} disabled={generating}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
              {generating ? "Generating..." : "Schedule Next Visit"}
            </button>
            <button onClick={() => handleStatus("expired")}
              className="px-4 py-2 border rounded-md hover:bg-gray-50 text-sm">
              Mark Expired
            </button>
          </>
        )}
        {contract.status === "expired" && (
          <button onClick={() => handleStatus("active")}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
            Reactivate Contract
          </button>
        )}
        <button onClick={() => handleStatus("cancelled")}
          className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 text-sm">
          Cancel Contract
        </button>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Visit History</h2>
        {visits.length === 0 ? (
          <p className="text-sm text-gray-400">No visits scheduled yet</p>
        ) : (
          <div className="space-y-2">
            {visits.map((v: any) => (
              <div key={v.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{v.scheduled_date}</p>
                  <p className="text-xs text-gray-500">
                    {v.status === "completed" ? `✓ Completed ${v.completed_at?.split("T")[0] || ""}` : "Scheduled"}
                  </p>
                  {v.notes && <p className="text-xs text-gray-400 mt-1">{v.notes}</p>}
                </div>
                {v.status === "scheduled" && (
                  <button onClick={() => handleComplete(v.id)} disabled={completing === v.id}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                    {completing === v.id ? "..." : "Complete"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
