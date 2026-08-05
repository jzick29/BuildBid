import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";

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
  const [draggedJob, setDraggedJob] = useState<any>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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

  const totalPipelineValue = jobs.filter((j: any) => j.status !== "completed").reduce((s: number, j: any) => s + (Number(j.total) || 0), 0);

  const handleDragStart = (e: React.DragEvent, job: any) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).style.opacity = "0.5";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    setDraggedJob(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, col: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(col);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (!draggedJob || draggedJob.status === newStatus) { setDragOverCol(null); return; }
    setSaving(true);
    try {
      await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "estimates.updateEstimateStatus", args: { data: { ids: [draggedJob.id], status: newStatus } } }),
        credentials: "include",
      });
      fetchJobs();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); setDragOverCol(null); }
  };

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center"><p className="text-red-500">{error}</p></div>;
  if (!user) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Pipeline</h1>
          {totalPipelineValue > 0 && (
            <div className="rounded-lg bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
              Pipeline Value: ${totalPipelineValue.toLocaleString()}
            </div>
          )}
        </div>
        <div className="mt-8 grid grid-cols-4 gap-4">
          {columns.map(col => (
            <div
              key={col}
              className={`rounded-xl border-2 p-4 transition-colors ${colColors[col]} ${dragOverCol === col ? "ring-2 ring-indigo-400 border-indigo-400" : ""} ${draggedJob ? "border-dashed" : ""}`}
              onDragOver={(e) => handleDragOver(e, col)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col)}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{colLabels[col]}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">{grouped[col].length}</span>
              </div>
              <div className="mt-3 space-y-2">
                {grouped[col].map((job: any) => (
                  <div
                    key={job.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, job)}
                    onDragEnd={handleDragEnd}
                    className={`rounded-lg border bg-white p-3 text-sm shadow-sm dark:bg-gray-900 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${draggedJob?.id === job.id ? "border-blue-400 ring-2 ring-blue-200 opacity-50" : "border-gray-200 dark:border-gray-800"}`}
                  >
                    <Link to="/estimates/$id" params={{ id: job.id }} className="font-medium text-indigo-600 hover:text-indigo-500">{job.project_name}</Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{job.customer_name} · {job.trade}</p>
                    {job.total > 0 && <p className="text-xs font-medium text-gray-700 dark:text-gray-300">${Number(job.total).toLocaleString()}</p>}
                    {job.start_date && <p className="text-xs text-gray-400">{job.start_date} – {job.end_date}</p>}
                  </div>
                ))}
                {grouped[col].length === 0 && (
                  <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-4 text-center text-xs text-gray-400">
                    Drop jobs here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {saving && <p className="mt-4 text-center text-sm text-gray-500">Saving...</p>}
      </main>
    </div>
  );
}
