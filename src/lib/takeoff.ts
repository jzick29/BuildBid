import { makeAuthFn } from "./iso";

// ─── takeoffs.list ────────────────────────────────────────────────
export const listTakeoffs = makeAuthFn("takeoffs.list", async (_args: any, userId: string, pool: any) => {
  const r = await pool.query(
    `SELECT t.id, t.title, t.scale_label, t.pixels_per_unit, t.created_at,
            COUNT(m.id) as measurement_count
     FROM takeoff_projects t
     LEFT JOIN takeoff_measurements m ON m.project_id = t.id
     WHERE t.user_id = $1
     GROUP BY t.id
     ORDER BY t.created_at DESC`,
    [userId]
  );
  return { projects: r.rows };
});

// ─── takeoffs.get ─────────────────────────────────────────────────
export const getTakeoff = makeAuthFn("takeoffs.get", async (args: { data: { projectId: string } }, userId: string, pool: any) => {
  const r = await pool.query("SELECT * FROM takeoff_projects WHERE id = $1 AND user_id = $2", [args.data.projectId, userId]);
  if (!r.rows[0]) throw new Error("Takeoff not found");
  const ms = await pool.query("SELECT * FROM takeoff_measurements WHERE project_id = $1 ORDER BY created_at", [args.data.projectId]);
  return { project: r.rows[0], measurements: ms.rows };
});

// ─── takeoffs.create ──────────────────────────────────────────────
export const createTakeoff = makeAuthFn(
  "takeoffs.create",
  async (args: { data: { title: string; imageUrl: string; scaleLabel?: string } }, userId: string, pool: any) => {
    const d = args.data || {};
    if (!d.title || !String(d.title).trim()) throw new Error("Title is required");
    if (!d.imageUrl || !String(d.imageUrl).startsWith("data:image/")) throw new Error("A blueprint image is required");
    if (String(d.imageUrl).length > 5_000_000) throw new Error("Image too large (max ~5MB after resize)");
    const id = crypto.randomUUID();
    await pool.query(
      "INSERT INTO takeoff_projects (id, user_id, title, image_url, scale_label) VALUES ($1, $2, $3, $4, $5)",
      [id, userId, String(d.title).trim(), d.imageUrl, d.scaleLabel || ""]
    );
    return { success: true, id };
  }
);

// ─── takeoffs.setScale ────────────────────────────────────────────
export const setScale = makeAuthFn(
  "takeoffs.setScale",
  async (args: { data: { projectId: string; pixelsPerUnit: number; scaleLabel?: string } }, userId: string, pool: any) => {
    const d = args.data || {};
    const ppu = Number(d.pixelsPerUnit);
    if (!Number.isFinite(ppu) || ppu <= 0) throw new Error("Invalid pixels-per-unit scale");
    const r = await pool.query(
      "UPDATE takeoff_projects SET pixels_per_unit = $1, scale_label = $2 WHERE id = $3 AND user_id = $4",
      [ppu, d.scaleLabel || "", d.projectId, userId]
    );
    if (r.rowCount === 0) throw new Error("Takeoff not found");
    return { success: true };
  }
);

// ─── takeoffs.addMeasurement ──────────────────────────────────────
export const addMeasurement = makeAuthFn(
  "takeoffs.addMeasurement",
  async (
    args: { data: { projectId: string; label: string; kind: string; points: number[]; value: number; unit: string } },
    userId: string,
    pool: any
  ) => {
    const d = args.data || {};
    const kinds = ["line", "area", "count"];
    if (!kinds.includes(d.kind)) throw new Error("Invalid measurement kind");
    if (!Array.isArray(d.points) || d.points.length < 2) throw new Error("Invalid points");
    const own = await pool.query("SELECT id FROM takeoff_projects WHERE id = $1 AND user_id = $2", [d.projectId, userId]);
    if (!own.rows[0]) throw new Error("Takeoff not found");
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO takeoff_measurements (id, project_id, label, kind, points, value, unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, d.projectId, d.label || "", d.kind, JSON.stringify(d.points), Number(d.value) || 0, d.unit || "ft"]
    );
    return { success: true, id };
  }
);

// ─── takeoffs.deleteMeasurement ───────────────────────────────────
export const deleteMeasurement = makeAuthFn("takeoffs.deleteMeasurement", async (args: { data: { measurementId: string } }, userId: string, pool: any) => {
  const r = await pool.query(
    "DELETE FROM takeoff_measurements WHERE id = $1 AND project_id IN (SELECT id FROM takeoff_projects WHERE user_id = $2)",
    [args.data.measurementId, userId]
  );
  if (r.rowCount === 0) throw new Error("Measurement not found");
  return { success: true };
});

// ─── takeoffs.delete ──────────────────────────────────────────────
export const deleteTakeoff = makeAuthFn("takeoffs.delete", async (args: { data: { projectId: string } }, userId: string, pool: any) => {
  const r = await pool.query("DELETE FROM takeoff_projects WHERE id = $1 AND user_id = $2", [args.data.projectId, userId]);
  if (r.rowCount === 0) throw new Error("Takeoff not found");
  return { success: true };
});
