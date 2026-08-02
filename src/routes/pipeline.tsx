import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { updateEstimateStatus } from "~/lib/estimates";

export const Route = createFileRoute("/pipeline")({
  loader: async () => ({}),
  component: PipelinePage,
});

const columns = ["won", "scheduled", "in-progress", "completed"];
const colLabels: Record<string,string> = { won: "Pending", scheduled: "Scheduled", "in-progress": "In Progress", completed: "Completed" };

const colColors: Record<string,string> = {
  won: "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20",
  scheduled: "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20",
  "in-progress": "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20",
  completed: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/20",
};

function PipelinePage() {
  const [user, setUser] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchJobs = () => {
    fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: "scheduling.getPipelineJobs", args: {} }),
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
        fetchJobs();
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const grouped: Record<string, any[]> = {};
  columns.forEach(c => { grouped[c] = jobs.filter((j: any) => j.status === c); });

  const handleDrop = async (jobId: string, newStatus: string) => {
    await updateEstimateStatus({ data: { id: jobId, status: newStatus } });
    router.invalidate();
  };

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
            <Link to="/schedule" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Schedule</Link>
            <Link to="/pipeline" className="font-semibold text-indigo-600 dark:text-indigo-400">Pipeline</Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-bold">Pipeline</h1>
        <div className="mt-8 grid grid-cols-4 gap-4">
          {columns.map(col => (
            <div key={col} className={`rounded-xl border-2 p-4 ${colColors[col]}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{colLabels[col]}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">{grouped[col].length}</span>
              </div>
              <div className="mt-3 space-y-2">
                {grouped[col].map((job: any) => (
                  <div key={job.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <Link to="/estimates/$id" params={{ id: job.id }} className="font-medium text-indigo-600 hover:text-indigo-500">{job.project_name}</Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{job.customer_name} · {job.trade}</p>
                    {job.start_date && <p className="text-xs text-gray-400">{job.start_date} – {job.end_date}</p>}
                    <div className="mt-2 flex gap-2">
                      {columns.filter(c => c !== col).map(c => (
                        <button key={c} onClick={() => handleDrop(job.id, c)} className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800" title={`Move to ${colLabels[c]}`}>
                          &rarr; {colLabels[c]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
