import { makeAuthFn } from "./iso";

export const setJobDates = makeAuthFn("scheduling.setJobDates", async (args: { data: { estimateId: string; startDate: string; endDate: string } }, userId, pool) => {
  await pool.query("UPDATE estimates SET start_date = $1, end_date = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4", [args.data.startDate, args.data.endDate, args.data.estimateId, userId]);
  return { success: true };
});

export const getScheduledJobs = makeAuthFn("scheduling.getScheduledJobs", async (args: { data?: { month?: string } }, userId, pool) => {
  let sql = "SELECT id, project_name, customer_name, trade, status, start_date, end_date FROM estimates WHERE user_id = $1 AND start_date IS NOT NULL AND start_date != ''";
  const params: any[] = [userId];
  if (args.data?.month) { sql += " AND start_date LIKE $2"; params.push(args.data.month + "%"); }
  sql += " ORDER BY start_date";
  return (await pool.query(sql, params)).rows;
});

export const getPipelineJobs = makeAuthFn("scheduling.getPipelineJobs", async (_args, userId, pool) => {
  return (await pool.query("SELECT id, project_name, customer_name, trade, status, start_date, end_date FROM estimates WHERE user_id = $1 AND status IN ('won','in-progress','completed') ORDER BY start_date", [userId])).rows;
});
