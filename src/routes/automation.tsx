import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/automation")({ component: AutomationPage });

const TRIGGERS = [
  { value: "estimate_won", label: "Estimate Won" },
  { value: "estimate_lost", label: "Estimate Lost" },
  { value: "proposal_sent", label: "Proposal Sent" },
  { value: "contract_expiring", label: "Contract Expiring (30 days)" },
  { value: "invoice_overdue", label: "Invoice Overdue" },
];
const ACTIONS = [
  { value: "send_email", label: "Send Email" },
  { value: "create_invoice", label: "Create Invoice" },
  { value: "schedule_visit", label: "Schedule Next Visit" },
  { value: "mark_status", label: "Change Estimate Status" },
];

function AutomationPage() {
  const [user, setUser] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", trigger_type: "estimate_won", action_type: "send_email", trigger_config: "{}", action_config: "{}", enabled: true });

  const fetchRules = async () => {
    try {
      const me = await fetch("/api/me", { credentials: "include" }).then(r => r.json());
      if (!me.user) { window.location.href = "/login"; return; }
      setUser(me.user);
      const r = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "automation.listRules", args: {} }), credentials: "include" }).then(r => r.json());
      setRules(Array.isArray(r) ? r : []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRules(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "automation.createRule", args: { data: { ...form, trigger_config: JSON.parse(form.trigger_config), action_config: JSON.parse(form.action_config) } } }), credentials: "include" });
      setShowCreate(false);
      setForm({ name: "", trigger_type: "estimate_won", action_type: "send_email", trigger_config: "{}", action_config: "{}", enabled: true });
      fetchRules();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleToggle = async (rule: any) => {
    await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "automation.toggleRule", args: { data: { id: rule.id, enabled: !rule.enabled } } }), credentials: "include" });
    fetchRules();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "automation.deleteRule", args: { data: { id } } }), credentials: "include" });
    fetchRules();
  };

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (!user) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Automations</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Create rules to automate your estimating workflow</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">New Rule</button>
        </div>

        {rules.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
            <p className="text-gray-500">No automation rules yet</p>
            <p className="mt-1 text-sm text-gray-400">Create a rule to automatically send emails, create invoices, or schedule visits.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {rules.map((rule: any) => {
              const trig = TRIGGERS.find(t => t.value === rule.trigger_type);
              const act = ACTIONS.find(a => a.value === rule.action_type);
              return (
                <div key={rule.id} className={`rounded-xl border p-5 ${rule.enabled ? "border-gray-200 dark:border-gray-800" : "border-gray-100 bg-gray-50 dark:border-gray-900 dark:bg-gray-950 opacity-60"}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{rule.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${rule.enabled ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>{rule.enabled ? "Active" : "Paused"}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        When <strong>{trig?.label || rule.trigger_type}</strong> → {act?.label || rule.action_type}
                      </p>
                      {rule.last_triggered_at && <p className="mt-1 text-xs text-gray-400">Last triggered: {new Date(rule.last_triggered_at).toLocaleString()}</p>}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button onClick={() => handleToggle(rule)} className="text-xs text-gray-500 hover:text-indigo-600">{rule.enabled ? "Pause" : "Enable"}</button>
                      <button onClick={() => handleDelete(rule.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">New Automation Rule</h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div><label className="mb-1 block text-sm font-medium">Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" required placeholder="e.g. Auto-invoice on won estimate" /></div>
              <div><label className="mb-1 block text-sm font-medium">When...</label>
                <select value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                  {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label className="mb-1 block text-sm font-medium">Do this...</label>
                <select value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                  {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div><label className="mb-1 block text-sm font-medium">Trigger Config (JSON)</label><textarea value={form.trigger_config} onChange={e => setForm(f => ({ ...f, trigger_config: e.target.value }))} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></div>
              <div><label className="mb-1 block text-sm font-medium">Action Config (JSON)</label><textarea value={form.action_config} onChange={e => setForm(f => ({ ...f, action_config: e.target.value }))} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? "Creating..." : "Create Rule"}</button>
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
