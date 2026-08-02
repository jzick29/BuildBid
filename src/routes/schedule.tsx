import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/schedule")({
  loader: async () => ({}),
  component: SchedulePage,
});

const tradeColors: Record<string, string> = {
  electrical: "bg-yellow-100 text-yellow-800 border-yellow-300",
  plumbing: "bg-blue-100 text-blue-800 border-blue-300",
  hvac: "bg-orange-100 text-orange-800 border-orange-300",
  roofing: "bg-red-100 text-red-800 border-red-300",
  general: "bg-green-100 text-green-800 border-green-300",
};

function SchedulePage() {
  const [user, setUser] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);

  const fetchJobs = (month: string) => {
    fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "scheduling.getScheduledJobs", args: { data: { month } } }),
      credentials: "include",
    })
    .then(r => r.json())
    .then(d => { if (Array.isArray(d)) setJobs(d); else setJobs([]); })
    .catch(e => setError(e.message));
  };

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!d.user) { window.location.href = "/login"; return; }
        setUser(d.user);
        fetchJobs(currentMonth);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const changeMonth = (offset: number) => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + offset);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    setCurrentMonth(newMonth);
    fetchJobs(newMonth);
  };

  const [cy, cm] = currentMonth.split("-").map(Number);
  const daysInMonth = new Date(cy, cm, 0).getDate();
  const firstDay = new Date(cy, cm - 1, 1).getDay();

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">{error}</p></div>;
  if (!user) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="text-xl font-bold text-indigo-600 dark:text-indigo-400">BuildBid</Link>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Dashboard</Link>
            <Link to="/schedule" className="font-semibold text-indigo-600 dark:text-indigo-400">Schedule</Link>
            <Link to="/pipeline" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Pipeline</Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Schedule</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => changeMonth(-1)} className="rounded-lg border border-gray-300 px-3 py-1 text-sm dark:border-gray-700">&larr;</button>
            <span className="text-lg font-semibold">{new Date(cy, cm-1).toLocaleString("en-US", {month:"long", year:"numeric"})}</span>
            <button onClick={() => changeMonth(1)} className="rounded-lg border border-gray-300 px-3 py-1 text-sm dark:border-gray-700">&rarr;</button>
          </div>
        </div>
        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 dark:border-gray-800 dark:bg-gray-950">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} className="p-2 text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({length: firstDay}).map((_,i) => <div key={"e"+i} className="min-h-[100px] border-b border-r border-gray-100 p-1 dark:border-gray-800"></div>)}
            {Array.from({length: daysInMonth}).map((_,i) => {
              const day = i + 1;
              const dateStr = `${currentMonth}-${String(day).padStart(2,"0")}`;
              const dayJobs = jobs.filter((j: any) => j.start_date <= dateStr && j.end_date >= dateStr);
              return (
                <div key={day} className="min-h-[100px] border-b border-r border-gray-100 p-1 dark:border-gray-800">
                  <span className="text-xs text-gray-400">{day}</span>
                  {dayJobs.map((j: any) => (
                    <Link key={j.id} to="/estimates/$id" params={{ id: j.id }} className={`mt-0.5 block rounded border px-1 py-0.5 text-xs font-medium truncate ${tradeColors[j.trade] || "bg-gray-100 border-gray-300"}`}>{j.project_name}</Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
