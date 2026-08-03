import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/team")({ component: TeamPage });

function TeamPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("estimator");
  const [inviting, setInviting] = useState(false);

  const loadTeam = async (meData?: any) => {
    try {
      const me = meData || await fetch("/api/me").then(r => r.json());
      if (!me.user) { window.location.href = "/login"; return; }
      setUser(me.user);
      const tRes = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "team.getTeamMembers", args: {} }), credentials: "include" });
      const t = await tRes.json();
      setMembers(t);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTeam(); }, []);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try { await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "team.inviteTeamMember", args: { data: { email: inviteEmail, role: inviteRole } } }), credentials: "include" }); setInviteEmail(""); alert("Invite sent!"); }
    catch (e: any) { alert("Error: " + e.message); }
    finally { setInviting(false); }
  };

  const handleRemove = async (memberId: string) => {
    try { await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "team.removeTeamMember", args: { data: { memberId } } }), credentials: "include" }); setMembers(members.filter(m => m.id !== memberId)); }
    catch (e: any) { alert("Error: " + e.message); }
  };

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">Error: {error}</p></div>;
  if (!user) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</Link>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Dashboard</Link>
            <Link to="/team" className="font-semibold text-indigo-600 dark:text-indigo-400">Team</Link>
            <span className="text-gray-600 dark:text-gray-400">{user.email}</span>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Team</h1>
        <div className="mt-6 rounded-xl border border-gray-200 p-6 dark:border-gray-800">
          <h2 className="font-semibold">Invite Team Member</h2>
          <div className="mt-4 flex gap-3">
            <input type="email" placeholder="Email address" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"><option value="estimator">Estimator</option><option value="admin">Admin</option></select>
            <button onClick={handleInvite} disabled={inviting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{inviting ? "Sending..." : "Invite"}</button>
          </div>
        </div>
        <div className="mt-6">
          {members.length === 0 ? <p className="text-gray-500">No team members yet</p> : (
            <div className="space-y-3">{members.map((m: any) => <div key={m.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800"><div><p className="font-medium">{m.name||m.email}</p><p className="text-sm text-gray-500">{m.email} · {m.role}</p></div><button onClick={() => handleRemove(m.id)} className="text-sm text-red-600 hover:underline">Remove</button></div>)}</div>
          )}
        </div>
      </main>
    </div>
  );
}
