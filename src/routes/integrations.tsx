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
};

function IntegrationsPage() {
  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  const [connected, setConnected] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [importing, setImporting] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

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
    } catch (e: any) {
      alert(e.message);
    }
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
    } finally {
      setImporting(null);
    }
  };

  const isConnected = (p: string) => connected.some((c) => c.platform === p);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Builder/GC Integrations</h1>
      <p className="text-gray-500 mb-6">Connect to builder platforms to import bid invitations and export proposals.</p>

      {importResult && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
          {importResult}
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(PLATFORM_META).map(([key, meta]) => {
          const conn = connected.find((c) => c.platform === key);
          return (
            <div key={key} className="border rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{meta.logo}</span>
                <div>
                  <h3 className="font-semibold">{meta.name}</h3>
                  {conn ? (
                    <p className="text-sm text-green-600">Connected {new Date(conn.connectedAt).toLocaleDateString()}</p>
                  ) : (
                    <p className="text-sm text-gray-400">Not connected</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {conn ? (
                  <>
                    <button
                      onClick={() => handleImportBids(key)}
                      disabled={importing === key}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {importing === key ? "Importing..." : "Import Bids"}
                    </button>
                    <button
                      onClick={() => handleDisconnect(key)}
                      className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(key)}
                    disabled={connecting === key}
                    className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
                  >
                    {connecting === key ? "Connecting..." : "Connect"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-3 bg-gray-50 rounded-lg text-sm text-gray-500">
        <strong>Tip:</strong> Connect your builder platforms to automatically pull in bid invitations as draft estimates 
        and push won proposals back as submitted bids. Credentials are stored securely and used only for API access.
      </div>
    </div>
  );
}
