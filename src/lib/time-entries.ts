// Time entries module — labor hour tracking for estimates
import { makeAuthFn } from "./iso";
import { getPool } from "./pool";

// List time entries for an estimate
makeAuthFn("timeEntries.listTimeEntries", async (args: any, userId: string, pool: any) => {
  const { estimateId } = args.data || args;
  if (!estimateId) throw new Error("estimateId is required");

  const result = await pool.query(
    `SELECT id, description, hours, crew_member, date, created_at 
     FROM time_entries 
     WHERE estimate_id = $1 AND user_id = $2 
     ORDER BY date DESC, created_at DESC`,
    [estimateId, userId]
  );

  return { timeEntries: result.rows };
});

// Create a new time entry
makeAuthFn("timeEntries.createTimeEntry", async (args: any, userId: string, pool: any) => {
  const { estimateId, description, hours, crewMember, date } = args.data || args;
  if (!estimateId) throw new Error("estimateId is required");
  if (!hours || hours <= 0) throw new Error("hours must be positive");

  // Verify estimate ownership
  const est = await pool.query(
    "SELECT id FROM estimates WHERE id = $1 AND user_id = $2",
    [estimateId, userId]
  );
  if (!est.rows[0]) throw new Error("Estimate not found");

  const result = await pool.query(
    `INSERT INTO time_entries (estimate_id, user_id, description, hours, crew_member, date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, description, hours, crew_member, date, created_at`,
    [estimateId, userId, description || "", hours, crewMember || "", date || new Date().toISOString().slice(0, 10)]
  );

  return { timeEntry: result.rows[0] };
});

// Delete a time entry
makeAuthFn("timeEntries.deleteTimeEntry", async (args: any, userId: string, pool: any) => {
  const { id } = args.data || args;
  if (!id) throw new Error("id is required");

  const result = await pool.query(
    "DELETE FROM time_entries WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId]
  );

  if (!result.rows[0]) throw new Error("Time entry not found");
  return { success: true };
});

// Get time summary for an estimate (actual vs estimated)
makeAuthFn("timeEntries.getTimeSummary", async (args: any, userId: string, pool: any) => {
  const { estimateId } = args.data || args;
  if (!estimateId) throw new Error("estimateId is required");

  const result = await pool.query(
    `SELECT COALESCE(SUM(hours), 0) as total_hours, COUNT(*) as entry_count
     FROM time_entries 
     WHERE estimate_id = $1 AND user_id = $2`,
    [estimateId, userId]
  );

  const summary = result.rows[0];
  return {
    totalHours: parseFloat(summary.total_hours),
    entryCount: parseInt(summary.entry_count),
  };
});
