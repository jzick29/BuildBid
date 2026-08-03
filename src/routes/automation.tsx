import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/automation")({
  loader: async () => ({}),
  component: AutomationPage,
});

function AutomationPage() {
  const router = useRouter();
  const [forms, setForms] = useState<Record<string,{enabled:boolean;template:string}>>({});
  const [saving, setSaving] = useState("");

  useEffect(() => {
    const f: any = {};
    for (const [k,v] of Object.entries(automations)) {
      f[k] = { enabled: (v as any).enabled !== false, template: (v as any).template || "" };
    }
    setForms(f);
  }, []);

  const handleSave = async (type: string) => {
    setSaving(type);
    await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "emailAutomations.saveAutomation", args: { data: { type, enabled: forms[type]?.enabled ?? true, template: forms[type]?.template ?? "" } } }), credentials: "include" });
    setSaving("");
  };

  const labels: Record<string,string> = {
    proposal_followup: "Proposal Follow-up — sent 3 days after unopened proposal",
    won_thankyou: "Won Job Thank You — sent when estimate is marked won",
    invoice_reminder: "Invoice Reminder — sent when invoice is overdue",
  };

  return (
    <div className="flex min-h-dvh flex-col">

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-bold">Email Automations</h1>
        {checks.triggers.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{checks.triggers.length} new automation trigger{checks.triggers.length > 1 ? "s" : ""} ready</p>
          </div>
        )}
        {Object.entries(labels).map(([type, label]) => (
          <div key={type} className="mt-6 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div><h2 className="font-semibold capitalize">{type.replace("_"," ")}</h2><p className="text-sm text-gray-500 dark:text-gray-400">{label}</p></div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" checked={forms[type]?.enabled ?? true} onChange={e => setForms({...forms, [type]: {...forms[type], enabled: e.target.checked}})} className="sr-only" />
                <div className={`h-6 w-11 rounded-full ${forms[type]?.enabled ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-700"}`}><div className={`h-4 w-4 translate-y-1 rounded-full bg-white transition ${forms[type]?.enabled ? "translate-x-6" : "translate-x-1"}`}></div></div>
              </label>
            </div>
            <textarea value={forms[type]?.template || ""} onChange={e => setForms({...forms, [type]: {...forms[type], template: e.target.value}})} placeholder="Custom template..." className="mt-3 w-full rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-700 dark:bg-gray-800" rows={2} />
            <button onClick={() => handleSave(type)} disabled={saving === type} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Save</button>
          </div>
        ))}
      </main>
    </div>
  );
}
