import { makeAuthFn, makeAuthFnFull } from "./iso";

export const getAutomations = makeAuthFn("emailAutomations.getAutomations", async (_args, userId, pool) => {
  const types = ["proposal_followup", "won_thankyou", "invoice_reminder"];
  const result: any = {};
  for (const type of types) {
    const r = await pool.query("SELECT * FROM email_automations WHERE user_id = $1 AND type = $2", [userId, type]);
    result[type] = r.rows[0] || { enabled: true, template: "", type };
  }
  return result;
});

export const saveAutomation = makeAuthFn("emailAutomations.saveAutomation", async (args: { data: { type: string; enabled: boolean; template: string } }, userId, pool) => {
  const existR = await pool.query("SELECT id FROM email_automations WHERE user_id = $1 AND type = $2", [userId, args.data.type]);
  if (existR.rows[0]) {
    await pool.query("UPDATE email_automations SET enabled = $1, template = $2 WHERE id = $3", [args.data.enabled ? 1 : 0, args.data.template, existR.rows[0].id]);
  } else {
    await pool.query("INSERT INTO email_automations (id, user_id, type, enabled, template) VALUES ($1,$2,$3,$4,$5)", [crypto.randomUUID(), userId, args.data.type, args.data.enabled ? 1 : 0, args.data.template]);
  }
  return { success: true };
});

export const checkAutomations = makeAuthFn("emailAutomations.checkAutomations", async (_args, userId, pool) => {
  const triggers: Array<{ type: string; estimateId: string; projectName: string; customerName: string }> = [];
  const unopened = (await pool.query("SELECT e.id, e.project_name, e.customer_name FROM estimates e LEFT JOIN proposal_views pv ON pv.estimate_id = e.id WHERE e.user_id = $1 AND e.status = 'sent' AND e.created_at < NOW() - INTERVAL '3 days' AND pv.id IS NULL", [userId])).rows;
  for (const e of unopened) {
    const logR = await pool.query("SELECT id FROM automation_logs WHERE user_id = $1 AND type = 'proposal_followup' AND estimate_id = $2", [userId, e.id]);
    if (!logR.rows[0]) {
      await pool.query("INSERT INTO automation_logs (id, user_id, type, estimate_id) VALUES ($1,$2,$3,$4)", [crypto.randomUUID(), userId, "proposal_followup", e.id]);
      triggers.push({ type: "proposal_followup", estimateId: e.id, projectName: e.project_name, customerName: e.customer_name });
    }
  }
  const overdue = (await pool.query("SELECT i.id, e.project_name, e.customer_name, i.estimate_id FROM invoices i JOIN estimates e ON e.id = i.estimate_id WHERE i.user_id = $1 AND i.status = 'sent' AND i.due_date < CURRENT_DATE", [userId])).rows;
  for (const inv of overdue) {
    const logR = await pool.query("SELECT id FROM automation_logs WHERE user_id = $1 AND type = 'invoice_reminder' AND estimate_id = $2", [userId, inv.estimate_id]);
    if (!logR.rows[0]) {
      await pool.query("INSERT INTO automation_logs (id, user_id, type, estimate_id) VALUES ($1,$2,$3,$4)", [crypto.randomUUID(), userId, "invoice_reminder", inv.estimate_id]);
      triggers.push({ type: "invoice_reminder", estimateId: inv.estimate_id, projectName: inv.project_name, customerName: inv.customer_name });
    }
  }
  return { triggers };
});
