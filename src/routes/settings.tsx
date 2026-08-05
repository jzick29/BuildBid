import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sub, setSub] = useState<any>(null);
  const [pushSubs, setPushSubs] = useState<any[]>([]);
  const [builderPlatforms, setBuilderPlatforms] = useState<any[]>([]);
  const [qbo, setQbo] = useState<any>({ connected: false });
  const [sms, setSms] = useState<any>({ enabled: true, mode: "dry-run", templates: [] });
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [smsTestPhone, setSmsTestPhone] = useState("");
  const [smsStatus, setSmsStatus] = useState("");
  const [branding, setBranding] = useState<any>(null);
  const [brandForm, setBrandForm] = useState({ companyName: "", logoUrl: "", primaryColor: "#4f46e5", accentColor: "#0ea5e9", customDomain: "", whiteLabel: false });
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandMsg, setBrandMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        const meData = await meRes.json();
        if (!meData.user) { window.location.href = "/login"; return; }
        setUser(meData.user);
        const fetchApi = (fn: string, args: any = {}) => fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: fn, args }), credentials: "include" }).then(r => r.json());
        const [subData, pushData, platData, smsSettings, smsLogData] = await Promise.all([
          fetchApi("subscriptions.getSubscriptionStatus").catch(() => ({ tier: "trial" })),
          fetchApi("push.getSubscriptions").catch(() => []),
          fetchApi("integrations.getConnectedPlatforms").catch(() => []),
          fetchApi("sms.getSettings").catch(() => null),
          fetchApi("sms.getLogs", { data: { limit: 20 } }).catch(() => null),
        ]);
        setSub(subData);
        setPushSubs(pushData);
        setBuilderPlatforms(platData);
        const b = await fetchApi("branding.get").catch(() => null);
        if (b?.branding) {
          setBranding(b.branding);
          setBrandForm({ companyName: b.branding.company_name || "", logoUrl: b.branding.logo_url || "", primaryColor: b.branding.primary_color || "#4f46e5", accentColor: b.branding.accent_color || "#0ea5e9", customDomain: b.branding.custom_domain || "", whiteLabel: !!b.branding.white_label });
        }
        if (smsSettings) setSms(smsSettings);
        if (smsLogData?.logs) setSmsLogs(smsLogData.logs);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading settings...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">Error: {error}</p></div>;
  if (!user) return null;

  const handleLogout = async () => { await fetch("/api/logout", { method: "POST" }); router.navigate({ to: "/" }); };

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

        <section className="mt-8 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
          <h2 className="text-lg font-semibold">Subscription</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Current plan: <span className="font-semibold capitalize">{sub?.tier || "trial"}</span>
            {sub?.trialEndsAt && <span> · Trial ends {new Date(sub.trialEndsAt).toLocaleDateString()}</span>}
          </p>
          <div className="mt-4 flex gap-3">
            <Link to="/subscribe" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Upgrade Plan</Link>
            {(sub?.tier !== "trial") && <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900">Manage Billing</button>}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
          <h2 className="text-lg font-semibold">Push Notifications</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Get notified when proposals are viewed.</p>
          {pushSubs.length > 0 ? (
            <div className="mt-4 space-y-2">{pushSubs.map((s: any) => <div key={s.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-950"><span className="text-sm truncate max-w-xs">{s.endpoint?.substring(0,60)}...</span><button onClick={() => fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "push.removeSubscription", args: { data: { endpoint: s.endpoint } } }), credentials: "include" }).then(() => setPushSubs(pushSubs.filter(x => x.endpoint !== s.endpoint)))} className="text-sm text-red-600 hover:underline">Remove</button></div>)}</div>
          ) : <p className="mt-4 text-sm text-gray-400">No push subscriptions</p>}
        </section>

        <section className="mt-6 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
          <h2 className="text-lg font-semibold">SMS Notifications</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Text alerts sent to customers for proposals, invoices, and appointments.
            {sms.mode === "dry-run" ? (
              <span className="mt-2 block rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                Dry-run mode — no real texts are sent. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER env vars to activate live delivery.
              </span>
            ) : (
              <span className="mt-2 block rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                Live mode — texts are delivered via Twilio.
              </span>
            )}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sms.enabled !== false} onChange={async (e) => { const res = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "sms.saveSettings", args: { data: { enabled: e.target.checked } } }), credentials: "include" }).then(r => r.json()); if (res.success) setSms({ ...sms, enabled: e.target.checked }); }} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
              Enable SMS notifications
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="text-xs font-medium text-gray-500">Test phone number</label>
              <input value={smsTestPhone} onChange={(e) => setSmsTestPhone(e.target.value)} placeholder="(555) 123-4567" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </div>
            <button onClick={async () => { if (!smsTestPhone.trim()) return; setSmsStatus("Sending…"); const res = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "sms.sendTest", args: { data: { phone: smsTestPhone } } }), credentials: "include" }).then(r => r.json()); setSmsStatus(res.status === "sent" ? "✓ Delivered" : res.status === "dry_run" ? "Logged (dry-run) — no real text sent" : res.skipped || "Failed"); const logs = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "sms.getLogs", args: { data: { limit: 20 } } }), credentials: "include" }).then(r => r.json()); if (logs.logs) setSmsLogs(logs.logs); }} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50" disabled={!smsTestPhone.trim()}>Send Test</button>
          </div>
          {smsStatus && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{smsStatus}</p>}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Message Templates</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(sms.templates || []).map((t: any) => (
                <div key={t.type} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t.description}</p>
                  <p className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-600 dark:bg-gray-950 dark:text-gray-400">{t.example}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent SMS Activity</h3>
            {smsLogs.length > 0 ? (
              <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-950 dark:text-gray-400"><tr><th className="px-3 py-2">Status</th><th className="px-3 py-2">To</th><th className="px-3 py-2">Message</th><th className="px-3 py-2">Time</th></tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
                    {smsLogs.map((l: any) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.status === "sent" ? "bg-emerald-50 text-emerald-700" : l.status === "dry_run" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"} dark:bg-opacity-20`}>{l.status}</span></td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{l.to_phone}</td>
                        <td className="max-w-[260px] truncate px-3 py-2 text-gray-600 dark:text-gray-400">{l.message}</td>
                        <td className="px-3 py-2 text-gray-500">{new Date(l.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="mt-3 text-sm text-gray-400">No SMS activity yet</p>}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
          <h2 className="text-lg font-semibold">Builder Integrations</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Connect to Buildertrend, CoConstruct, or Procore.</p>
          {builderPlatforms.length > 0 ? (
            <div className="mt-4 space-y-2">{builderPlatforms.map((p: any) => <div key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-950"><span className="text-sm font-medium capitalize">{p.platform}</span><button onClick={() => fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "integrations.disconnectPlatform", args: { data: { platform: p.platform } } }), credentials: "include" }).then(() => setBuilderPlatforms(builderPlatforms.filter(x => x.platform !== p.platform)))} className="text-sm text-red-600 hover:underline">Disconnect</button></div>)}</div>
          ) : <p className="mt-4 text-sm text-gray-400">No integrations connected</p>}
          <button onClick={async () => { const res = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "integrations.getConnectionUrl", args: { data: { platform: "buildertrend" } } }), credentials: "include" }); const data = await res.json(); if (data.url) window.open(data.url, "_blank"); }} className="mt-4 rounded-lg border border-indigo-300 px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950">+ Connect Builder Platform</button>
        </section>
        <section className="mt-6 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">White-Label Branding <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">Shop Tier</span></h2>
            {brandMsg && <span className="text-xs text-green-600 dark:text-green-400">{brandMsg}</span>}
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Replace BuildBid branding with your own company name, logo, and colors across the app. Enable White Label to remove BuildBid from the interface entirely.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Company name</label>
              <input value={brandForm.companyName} onChange={e => setBrandForm({ ...brandForm, companyName: e.target.value })} placeholder="e.g. Acme Electrical" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Logo URL</label>
              <input value={brandForm.logoUrl} onChange={e => setBrandForm({ ...brandForm, logoUrl: e.target.value })} placeholder="https://…/logo.png" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Primary color</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={brandForm.primaryColor} onChange={e => setBrandForm({ ...brandForm, primaryColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded border border-gray-300 dark:border-gray-700" />
                <input value={brandForm.primaryColor} onChange={e => setBrandForm({ ...brandForm, primaryColor: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Accent color</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={brandForm.accentColor} onChange={e => setBrandForm({ ...brandForm, accentColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded border border-gray-300 dark:border-gray-700" />
                <input value={brandForm.accentColor} onChange={e => setBrandForm({ ...brandForm, accentColor: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Custom domain</label>
              <input value={brandForm.customDomain} onChange={e => setBrandForm({ ...brandForm, customDomain: e.target.value })} placeholder="app.acme.com" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
              <p className="mt-1 text-[11px] text-gray-400">Point a CNAME to buildbid.pro — full domain setup is handled by your account manager.</p>
            </div>
            <label className="flex items-center gap-2 pt-6 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={brandForm.whiteLabel} onChange={e => setBrandForm({ ...brandForm, whiteLabel: e.target.checked })} className="h-4 w-4 rounded border-gray-300" />
              White label — hide all BuildBid branding
            </label>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
              <span className="text-xs text-gray-400">Preview:</span>
              {brandForm.logoUrl ? <img src={brandForm.logoUrl} alt="logo" className="h-6 w-6 rounded object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : null}
              <span className="text-sm font-bold" style={{ color: brandForm.primaryColor }}>{brandForm.companyName || (brandForm.whiteLabel ? "Your Company" : "BuildBid")}</span>
            </div>
            <button onClick={async () => {
              setBrandSaving(true); setBrandMsg("");
              try {
                const res = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "branding.save", args: { data: brandForm } }), credentials: "include" });
                const d = await res.json();
                if (d.error) throw new Error(d.error);
                setBrandMsg("Branding saved — refresh the page to see it applied.");
                const b = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "branding.get", args: {} }), credentials: "include" }).then(r => r.json());
                if (b?.branding) setBranding(b.branding);
              } catch (e: any) { setBrandMsg(e.message); }
              finally { setBrandSaving(false); }
            }} disabled={brandSaving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{brandSaving ? "Saving…" : "Save Branding"}</button>
          </div>
        </section>
      </main>
    </div>
  );
}
