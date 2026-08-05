import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/integrations")({
  component: IntegrationsPage,
  loader: async () => ({}),
});

const PLATFORM_META: Record<string, { name: string; logo: string; color: string }> = {
  buildertrend: { name: "Buildertrend", logo: "🏗️", color: "bg-orange-100 text-orange-800" },
  coconstruct: { name: "CoConstruct", logo: "🏠", color: "bg-blue-100 text-blue-800" },
  procore: { name: "Procore", logo: "🔧", color: "bg-purple-100 text-purple-800" },
  quickbooks: { name: "QuickBooks", logo: "📊", color: "bg-green-100 text-green-800" },
};

type CalendarStatus = { connected: boolean; connectedAt: string | null; calendarId: string | null; events: any[] };
type WebhookEndpoint = { id: string; name: string; url: string; events: string; active: number };
type ApiKey = { id: string; name: string; key_prefix: string; created_at: string; revoked: number };

function IntegrationsPage() {
  const [connected, setConnected] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  // Google Calendar state
  const [cal, setCal] = useState<CalendarStatus | null>(null);
  const [calBusy, setCalBusy] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);

  // Webhook hub state
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [endpointLimit, setEndpointLimit] = useState<number | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [epName, setEpName] = useState("");
  const [epUrl, setEpUrl] = useState("");
  const [epEvents, setEpEvents] = useState<string[]>(["estimate.sent"]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const call = async (fn: string, data?: any) => {
    const res = await fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: fn, args: data ? { data } : {} }),
      credentials: "include",
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    return d;
  };

  useEffect(() => {
    fetch("/api/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "integrations.getConnectedPlatforms", args: {} }),
      credentials: "include",
    })
    .then(r => r.json())
    .then(d => { if (Array.isArray(d)) setConnected(d); })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  // Load calendar + webhook status once
  useEffect(() => {
    (async () => {
      try { const c = await call("calendar.getStatus"); setCal(c); } catch { /* not configured */ }
      try { const k = await call("webhooks.listApiKeys"); setKeys(k.keys || []); } catch { /* noop */ }
      try {
        const w = await call("webhooks.listEndpoints");
        setEndpoints(w.endpoints || []);
        setEndpointLimit(w.limit);
      } catch { /* noop */ }
      try { const l = await call("webhooks.getLogs", { limit: 10 }); setLogs(l.logs || []); } catch { /* noop */ }
    })();
  }, []);

  const handleConnect = async (platform: string) => {
    setConnecting(platform);
    try {
      const res = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "integrations.getConnectionUrl", args: { data: { platform } } }), credentials: "include" });
      const { url } = await res.json();
      window.location.href = url;
    } catch (e: any) {
      alert(e.message);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (platform: string) => {
    if (!confirm(`Disconnect ${PLATFORM_META[platform]?.name || platform}?`)) return;
    try {
      await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "integrations.disconnectPlatform", args: { data: { platform } } }), credentials: "include" });
      setConnected(connected.filter((p) => p.platform !== platform));
    } catch (e: any) { alert(e.message); }
  };

  const handleImportBids = async (platform: string) => {
    setImporting(platform);
    setImportResult(null);
    try {
      const resp = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "integrations.importBidsFromPlatform", args: { data: { platform } } }), credentials: "include" });
      const result = await resp.json();
      setImportResult(`Imported ${result.imported} new bid${result.imported !== 1 ? "s" : ""} from ${result.total} total.`);
    } catch (e: any) {
      setImportResult(`Error: ${e.message}`);
    } finally { setImporting(null); }
  };

  const isConnected = (p: string) => connected.some((c) => c.platform === p);

  // ─── Google Calendar handlers ────────────────────────────────────
  const connectGoogle = async () => {
    setCalBusy(true); setCalError(null);
    try {
      const { url } = await call("calendar.getAuthUrl");
      window.location.href = url;
    } catch (e: any) { setCalError(e.message); setCalBusy(false); }
  };

  const disconnectGoogle = async () => {
    if (!confirm("Disconnect Google Calendar? Synced events will be removed.")) return;
    setCalBusy(true);
    try { await call("calendar.disconnect"); setCal({ connected: false, connectedAt: null, calendarId: null, events: [] }); }
    catch (e: any) { setCalError(e.message); }
    finally { setCalBusy(false); }
  };

  const deleteCalEvent = async (eventId: string) => {
    if (!confirm("Delete this calendar event?")) return;
    try {
      await call("calendar.deleteEvent", { eventId });
      setCal(cal ? { ...cal, events: cal.events.filter((e: any) => e.id !== eventId) } : cal);
    } catch (e: any) { alert(e.message); }
  };

  // ─── Webhook handlers ────────────────────────────────────────────
  const createKey = async () => {
    setBusy("key");
    try {
      const r = await call("webhooks.createApiKey", { name: newKeyName });
      setCreatedKey(r.key);
      setNewKeyName("");
      const k = await call("webhooks.listApiKeys"); setKeys(k.keys || []);
    } catch (e: any) { alert(e.message); }
    finally { setBusy(null); }
  };

  const revokeKey = async (id: string) => {
    if (!confirm("Revoke this API key? Connections using it will stop working.")) return;
    try {
      await call("webhooks.revokeApiKey", { id });
      setKeys(keys.map((k) => (k.id === id ? { ...k, revoked: 1 } : k)));
    } catch (e: any) { alert(e.message); }
  };

  const createEndpoint = async () => {
    setBusy("ep");
    try {
      const r = await call("webhooks.createEndpoint", { name: epName, url: epUrl, events: epEvents });
      setCreatedSecret(r.secret);
      setEpName(""); setEpUrl("");
      const w = await call("webhooks.listEndpoints");
      setEndpoints(w.endpoints || []); setEndpointLimit(w.limit);
    } catch (e: any) { alert(e.message); }
    finally { setBusy(null); }
  };

  const deleteEndpoint = async (id: string) => {
    if (!confirm("Delete this webhook endpoint?")) return;
    try {
      await call("webhooks.deleteEndpoint", { id });
      setEndpoints(endpoints.filter((e) => e.id !== id));
    } catch (e: any) { alert(e.message); }
  };

  const testFire = async (id: string) => {
    setBusy("test");
    try {
      const r = await call("webhooks.testFire", { id });
      alert(`Test delivery: HTTP ${r.statusCode} — ${r.response || "ok"}`);
      const l = await call("webhooks.getLogs", { limit: 10 }); setLogs(l.logs || []);
    } catch (e: any) { alert(e.message); }
    finally { setBusy(null); }
  };

  const loadLogs = async () => {
    try { const l = await call("webhooks.getLogs", { limit: 20 }); setLogs(l.logs || []); } catch { /* noop */ }
  };

  const toggleEvent = (ev: string) => {
    setEpEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]);
  };

  const WEBHOOK_EVENT_OPTIONS = [
    { id: "estimate.sent", label: "Estimate sent" },
    { id: "estimate.won", label: "Estimate won" },
    { id: "invoice.paid", label: "Invoice paid" },
    { id: "job.scheduled", label: "Job scheduled" },
    { id: "job.completed", label: "Job completed" },
  ];

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Integrations</h1>
      <p className="text-gray-500 mb-6">Connect builder platforms, accounting tools, Google Calendar, and automation services.</p>

      {importResult && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300">{importResult}</div>
      )}

      {/* ── Builder platforms ── */}
      <h2 className="text-lg font-semibold mb-3 mt-2">Builder Platforms & Accounting</h2>
      <div className="space-y-4">
        {Object.entries(PLATFORM_META).map(([key, meta]) => {
          const conn = connected.find((c) => c.platform === key);
          return (
            <div key={key} className="border rounded-lg p-4 flex items-center justify-between dark:border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{meta.logo}</span>
                <div>
                  <h3 className="font-semibold">{meta.name}</h3>
                  {conn ? (
                    <p className="text-sm text-green-600 dark:text-green-400">Connected {new Date(conn.connectedAt || conn.connected_at).toLocaleDateString()}</p>
                  ) : (
                    <p className="text-sm text-gray-400">Not connected</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {conn ? (
                  <>
                    {key !== "quickbooks" && (
                      <button onClick={() => handleImportBids(key)} disabled={importing === key}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                        {importing === key ? "Importing..." : "Import Bids"}
                      </button>
                    )}
                    {key === "quickbooks" && (
                      <span className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-md dark:bg-green-950/50 dark:text-green-400">Synced</span>
                    )}
                    <button onClick={() => handleDisconnect(key)} className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">Disconnect</button>
                  </>
                ) : (
                  <button onClick={() => handleConnect(key)} disabled={connecting === key}
                    className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
                    {connecting === key ? "Connecting..." : "Connect"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Google Calendar ── */}
      <h2 className="text-lg font-semibold mb-3 mt-8">Google Calendar</h2>
      <div className="border rounded-lg p-4 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <h3 className="font-semibold">Job Calendar Sync</h3>
              {cal?.connected ? (
                <p className="text-sm text-green-600 dark:text-green-400">Connected {cal.connectedAt ? new Date(cal.connectedAt).toLocaleDateString() : ""}</p>
              ) : (
                <p className="text-sm text-gray-400">Not connected</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cal?.connected ? (
              <>
                <span className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-md dark:bg-green-950/50 dark:text-green-400">{cal.events?.length || 0} synced</span>
                <button onClick={disconnectGoogle} disabled={calBusy}
                  className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">Disconnect</button>
              </>
            ) : (
              <button onClick={connectGoogle} disabled={calBusy}
                className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
                {calBusy ? "Redirecting..." : "Connect Google Calendar"}
              </button>
            )}
          </div>
        </div>
        {calError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{calError}</p>}
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {cal?.connected
            ? "Scheduled jobs are automatically pushed to your calendar. Use “Add to Calendar” on any estimate to create a custom event, or download an .ics file when you're not connected."
            : "When connected, jobs you mark as scheduled are pushed to your Google Calendar automatically. Requires the Pro or Shop plan."}
        </p>
        {cal?.connected && cal.events && cal.events.length > 0 && (
          <div className="mt-3 border-t pt-3 dark:border-gray-800">
            <h4 className="text-sm font-medium mb-2">Recently synced events</h4>
            <ul className="space-y-1.5">
              {cal.events.slice(0, 6).map((ev: any) => (
                <li key={ev.id} className="flex items-center justify-between text-sm">
                  <span>{ev.summary || ev.project_name} <span className="text-gray-400">· {new Date(ev.event_start).toLocaleDateString()}</span></span>
                  <button onClick={() => deleteCalEvent(ev.id)} className="text-xs text-red-500 hover:underline">Remove</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Zapier / Webhook Hub ── */}
      <h2 className="text-lg font-semibold mb-3 mt-8">Zapier & Webhooks</h2>
      <div className="border rounded-lg p-4 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">⚡</span>
          <div>
            <h3 className="font-semibold">Automation Hub</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {endpointLimit === null ? "Unlimited webhooks (Shop plan)" : endpointLimit === 0 ? "Upgrade to Pro or Shop for webhooks" : `${endpointLimit - endpoints.length} of ${endpointLimit} webhook slots remaining (Pro plan)`}
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Create an API key to connect Zapier and external tools, or register webhook endpoints to receive real-time events
          (estimate sent/won, invoice paid, job scheduled/completed). Every delivery is HMAC-signed with a per-endpoint secret and logged here.
        </p>

        {/* API Keys */}
        <h4 className="text-sm font-semibold mb-2 mt-4">API Keys</h4>
        <div className="flex gap-2 mb-2">
          <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name (e.g. Zapier)"
            className="flex-1 px-3 py-1.5 text-sm border rounded-md dark:bg-gray-900 dark:border-gray-700" />
          <button onClick={createKey} disabled={busy === "key"}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">Generate Key</button>
        </div>
        {createdKey && (
          <div className="mb-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm dark:bg-amber-950/30 dark:border-amber-800">
            <strong>Copy your key now — it won't be shown again:</strong>
            <pre className="mt-1 text-xs bg-white/60 rounded p-2 overflow-x-auto dark:bg-gray-900">{createdKey}</pre>
          </div>
        )}
        {keys.length > 0 && (
          <ul className="space-y-1.5 mb-4">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between text-sm">
                <span>{k.name} <code className="text-xs bg-gray-100 rounded px-1 py-0.5 dark:bg-gray-800">{k.key_prefix}…</code> {k.revoked === 1 && <span className="text-red-500 text-xs">revoked</span>}</span>
                {k.revoked === 0 && <button onClick={() => revokeKey(k.id)} className="text-xs text-red-500 hover:underline">Revoke</button>}
              </li>
            ))}
          </ul>
        )}

        {/* Endpoints */}
        <h4 className="text-sm font-semibold mb-2 mt-4">Webhook Endpoints</h4>
        {endpointLimit !== 0 && (
          <div className="space-y-2 mb-3">
            <input value={epName} onChange={(e) => setEpName(e.target.value)} placeholder="Name (e.g. Slack channel)"
              className="w-full px-3 py-1.5 text-sm border rounded-md dark:bg-gray-900 dark:border-gray-700" />
            <input value={epUrl} onChange={(e) => setEpUrl(e.target.value)} placeholder="https://your-app.example.com/hook"
              className="w-full px-3 py-1.5 text-sm border rounded-md dark:bg-gray-900 dark:border-gray-700" />
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENT_OPTIONS.map((ev) => (
                <label key={ev.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={epEvents.includes(ev.id)} onChange={() => toggleEvent(ev.id)} />
                  {ev.label}
                </label>
              ))}
            </div>
            <button onClick={createEndpoint} disabled={busy === "ep"}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">Create Webhook</button>
          </div>
        )}
        {createdSecret && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm dark:bg-amber-950/30 dark:border-amber-800">
            <strong>Signing secret (verify X-BuildBid-Signature header):</strong>
            <pre className="mt-1 text-xs bg-white/60 rounded p-2 overflow-x-auto dark:bg-gray-900">{createdSecret}</pre>
          </div>
        )}
        {endpoints.length > 0 && (
          <ul className="space-y-1.5">
            {endpoints.map((e) => (
              <li key={e.id} className="flex items-center justify-between text-sm">
                <span>{e.name || e.url} <span className="text-gray-400">· {e.url}</span></span>
                <span className="flex items-center gap-2">
                  <button onClick={() => testFire(e.id)} disabled={busy === "test"} className="text-xs text-blue-500 hover:underline disabled:opacity-50">Test</button>
                  <button onClick={() => deleteEndpoint(e.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Delivery log */}
        <div className="flex items-center justify-between mt-4">
          <h4 className="text-sm font-semibold">Delivery Log</h4>
          <button onClick={loadLogs} className="text-xs text-blue-500 hover:underline">Refresh</button>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400 mt-1">No deliveries yet. Create an endpoint and mark an estimate as won/sent to see events here.</p>
        ) : (
          <ul className="space-y-1.5 mt-1">
            {logs.slice(0, 8).map((l: any) => (
              <li key={l.id} className="flex items-center justify-between text-xs">
                <span className="font-mono">{l.event} <span className="text-gray-400">· {new Date(l.created_at).toLocaleString()}</span></span>
                <span className={l.status_code >= 200 && l.status_code < 300 ? "text-green-600" : "text-red-500"}>
                  {l.status_code === 0 ? "failed" : `HTTP ${l.status_code}`} · {l.duration_ms}ms
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-gray-400">Zapier app manifest: available via <code>webhooks.getManifest</code> (used when submitting the BuildBid app to the Zapier platform).</p>
      </div>

      <div className="mt-6 p-3 bg-gray-50 rounded-lg text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
        <strong>Tip:</strong> Connect builder platforms to pull bid invitations as draft estimates, QuickBooks for invoice sync, Google Calendar for automatic job scheduling, and webhooks/Zapier to connect everything else. Credentials are stored securely.
      </div>
    </div>
  );
}
