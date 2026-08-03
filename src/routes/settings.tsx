import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getSubscriptionStatus } from "~/lib/subscriptions";
import { saveSubscription, removeSubscription, getSubscriptions, getVapidPublicKey } from "~/lib/push";
import { getConnectionUrl, getConnectedPlatforms, disconnectPlatform } from "~/lib/integrations";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sub, setSub] = useState<any>(null);
  const [pushSubs, setPushSubs] = useState<any[]>([]);
  const [builderPlatforms, setBuilderPlatforms] = useState<any[]>([]);
  const [qbo, setQbo] = useState<any>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        const meData = await meRes.json();
        if (!meData.user) { window.location.href = "/login"; return; }
        setUser(meData.user);
        const [subData, pushData, platData] = await Promise.all([
          getSubscriptionStatus().catch(() => ({ tier: "trial" })),
          getSubscriptions().catch(() => []),
          getConnectedPlatforms().catch(() => []),
        ]);
        setSub(subData);
        setPushSubs(pushData);
        setBuilderPlatforms(platData);
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
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</Link>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Dashboard</Link>
            <Link to="/settings" className="font-semibold text-indigo-600 dark:text-indigo-400">Settings</Link>
            <span className="text-gray-600 dark:text-gray-400">{user.email}</span>
            <button onClick={handleLogout} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900">Sign Out</button>
          </div>
        </nav>
      </header>
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
            <div className="mt-4 space-y-2">{pushSubs.map((s: any) => <div key={s.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-950"><span className="text-sm truncate max-w-xs">{s.endpoint?.substring(0,60)}...</span><button onClick={() => removeSubscription({ data: { endpoint: s.endpoint } }).then(() => setPushSubs(pushSubs.filter(x => x.endpoint !== s.endpoint)))} className="text-sm text-red-600 hover:underline">Remove</button></div>)}</div>
          ) : <p className="mt-4 text-sm text-gray-400">No push subscriptions</p>}
        </section>

        <section className="mt-6 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
          <h2 className="text-lg font-semibold">Builder Integrations</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Connect to Buildertrend, CoConstruct, or Procore.</p>
          {builderPlatforms.length > 0 ? (
            <div className="mt-4 space-y-2">{builderPlatforms.map((p: any) => <div key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-950"><span className="text-sm font-medium capitalize">{p.platform}</span><button onClick={() => disconnectPlatform({ data: { id: p.id } }).then(() => setBuilderPlatforms(builderPlatforms.filter(x => x.id !== p.id)))} className="text-sm text-red-600 hover:underline">Disconnect</button></div>)}</div>
          ) : <p className="mt-4 text-sm text-gray-400">No integrations connected</p>}
          <button onClick={async () => { const url = await getConnectionUrl({ data: { platform: "buildertrend" } }); if (url) window.open(url, "_blank"); }} className="mt-4 rounded-lg border border-indigo-300 px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950">+ Connect Builder Platform</button>
        </section>
      </main>
    </div>
  );
}
