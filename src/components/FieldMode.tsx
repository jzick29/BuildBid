import { useState } from "react";

interface FieldModeProps {
  estimate: any;
  lineItems: any[];
  timeEntries: any[];
  expenses: any[];
  showTimeForm: boolean;
  showExpenseForm: boolean;
  onToggleTime: () => void;
  onToggleExpense: () => void;
}

export function FieldMode({
  estimate,
  lineItems,
  timeEntries,
  expenses,
  showTimeForm,
  showExpenseForm,
  onToggleTime,
  onToggleExpense,
}: FieldModeProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handlePullRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const totalCost = lineItems
    .reduce((sum: number, li: any) => {
      const cost = (li.unit_cost || 0) * (li.quantity || 0);
      const markup = cost * ((li.markup_pct || 0) / 100);
      return sum + cost + markup;
    }, 0)
    .toFixed(2);

  const totalHours = timeEntries
    .reduce((sum: number, te: any) => sum + (Number(te.hours) || 0), 0)
    .toFixed(1);

  const totalExpenses = expenses
    .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0)
    .toFixed(2);

  return (
    <div className="relative min-h-screen bg-gray-50 dark:bg-gray-950 sm:hidden" onTouchEnd={handlePullRefresh}>
      {/* Pull-to-refresh indicator */}
      {refreshing && (
        <div className="flex justify-center py-3">
          <svg className="h-6 w-6 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{estimate?.title || "Estimate"}</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{estimate?.customer_name || "—"}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        <div className="rounded-xl bg-white p-3 text-center shadow-sm dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">${totalCost}</p>
        </div>
        <div className="rounded-xl bg-white p-3 text-center shadow-sm dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Hours</p>
          <p className="mt-1 text-lg font-bold text-indigo-600 dark:text-indigo-400">{totalHours}</p>
        </div>
        <div className="rounded-xl bg-white p-3 text-center shadow-sm dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Expenses</p>
          <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">${totalExpenses}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2 px-4 py-1">
        <button onClick={onToggleTime} className="flex flex-col items-center gap-1 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
          <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Time</span>
        </button>
        <button onClick={onToggleExpense} className="flex flex-col items-center gap-1 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
          <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Expense</span>
        </button>
        <button className="flex flex-col items-center gap-1 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
          <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Sign</span>
        </button>
        <button className="flex flex-col items-center gap-1 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
          <svg className="h-6 w-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          </svg>
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Photo</span>
        </button>
      </div>

      {/* Line Items */}
      <div className="px-4 py-3">
        <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Line Items</h3>
        <div className="space-y-2">
          {lineItems.length === 0 ? (
            <p className="text-sm text-gray-400">No line items</p>
          ) : (
            lineItems.map((li: any) => (
              <div key={li.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm dark:bg-gray-900">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{li.description || "Item"}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Qty: {li.quantity} &times; ${(li.unit_cost || 0).toFixed(2)}
                  </p>
                </div>
                <p className="ml-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  ${((li.unit_cost || 0) * (li.quantity || 0) * (1 + (li.markup_pct || 0) / 100)).toFixed(2)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Time Entries */}
      {timeEntries.length > 0 && (
        <div className="px-4 py-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Time ({totalHours}h)</h3>
          <div className="space-y-1">
            {timeEntries.slice(0, 5).map((te: any) => (
              <div key={te.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-2 shadow-sm dark:bg-gray-900">
                <span className="text-sm text-gray-600 dark:text-gray-400">{te.description || "Time entry"}</span>
                <span className="text-sm font-medium">{Number(te.hours).toFixed(1)}h</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
