import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getPublicChangeOrder, approveChangeOrder } from "~/lib/change-order-workflow";

export const Route = createFileRoute("/co/$id")({
  loader: async ({ params }) => {
    const data = await getPublicChangeOrder({ data: { id: params.id } });
    return data;
  },
  component: CoPage,
});

function CoPage() {
  const { changeOrder, items } = Route.useLoaderData();
  const [responding, setResponding] = useState(false);
  const [status, setStatus] = useState(changeOrder.status);

  const total = items.reduce((sum: number, i: any) => sum + (i.quantity * i.unit_cost * (1 + i.markup_percent / 100)), 0);

  const handleResponse = async (approved: boolean) => {
    setResponding(true);
    try {
      const res = await approveChangeOrder({ data: { changeOrderId: changeOrder.id, approved } });
      setStatus(res.status);
    } catch(e) {}
    finally { setResponding(false); }
  };

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <div className="rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-xl font-bold">Change Order</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{changeOrder.project_name} · {changeOrder.customer_name}</p>
        <h2 className="mt-3 text-lg font-semibold">{changeOrder.title}</h2>
        {changeOrder.description && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{changeOrder.description}</p>}

        <div className="mt-6 space-y-2 text-sm">
          {items.map((item: any) => (
            <div key={item.id} className="flex justify-between">
              <span>{item.description} × {item.quantity} {item.unit}</span>
              <span className="font-medium">${(item.quantity * item.unit_cost * (1 + item.markup_percent / 100)).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-right text-lg font-bold text-indigo-600 dark:text-indigo-400">${total.toFixed(2)}</p>

        {status === "sent" ? (
          <div className="mt-8 flex gap-3">
            <button onClick={() => handleResponse(true)} disabled={responding} className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              ✓ Approve
            </button>
            <button onClick={() => handleResponse(false)} disabled={responding} className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              ✗ Reject
            </button>
          </div>
        ) : (
          <div className={`mt-8 rounded-lg p-4 text-center text-sm font-medium ${status === "approved" ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"}`}>
            {status === "approved" ? "✓ Approved" : "✗ Rejected"}
          </div>
        )}
      </div>
    </div>
  );
}
