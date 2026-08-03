import { makeAuthFn, makeAuthFnFull } from "./iso";

const FREQUENCIES: Record<string, { label: string; months: number }> = {
  monthly: { label: "Monthly", months: 1 }, quarterly: { label: "Quarterly", months: 3 }, "semi-annual": { label: "Semi-Annual", months: 6 }, annual: { label: "Annual", months: 12 },
};

export const createContract = makeAuthFnFull("contracts.createContract", async (args: { data: { customerName: string; projectName: string; trade: string; frequency: string; scopeOfWork: string; startDate: string; endDate?: string; amount: number; estimateId?: string } }, user, pool) => {
  const freq = FREQUENCIES[args.data.frequency] || FREQUENCIES.quarterly;
  const start = new Date(args.data.startDate);
  const nextVisit = new Date(start); nextVisit.setMonth(nextVisit.getMonth() + freq.months);
  const id = crypto.randomUUID();
  await pool.query("INSERT INTO contracts (id, user_id, customer_name, project_name, trade, frequency, scope_of_work, start_date, end_date, next_visit_date, amount, estimate_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)", [id, user.id, args.data.customerName, args.data.projectName, args.data.trade, args.data.frequency, args.data.scopeOfWork, args.data.startDate, args.data.endDate || "", nextVisit.toISOString().split("T")[0], args.data.amount, args.data.estimateId || null]);
  if (args.data.estimateId) await pool.query("UPDATE estimates SET contract_id = $1 WHERE id = $2", [id, args.data.estimateId]);
  return { id };
});

export const createContractFromEstimate = makeAuthFnFull("contracts.createContractFromEstimate", async (args: { data: { estimateId: string; frequency: string; scopeOfWork: string } }, user, pool) => {
  const estR = await pool.query("SELECT * FROM estimates WHERE id = $1 AND user_id = $2 AND status = 'won'", [args.data.estimateId, user.id]);
  if (!estR.rows[0]) throw new Error("Estimate not found or not won");
  const est = estR.rows[0];
  const items = (await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [args.data.estimateId])).rows;
  const total = items.reduce((s: number, i: any) => s + i.quantity * i.unit_cost * (1 + i.markup_percent / 100), 0);
  const freq = FREQUENCIES[args.data.frequency] || FREQUENCIES.quarterly;
  const start = new Date(); const nextVisit = new Date(); nextVisit.setMonth(nextVisit.getMonth() + freq.months);
  const id = crypto.randomUUID();
  await pool.query("INSERT INTO contracts (id, user_id, customer_name, project_name, trade, frequency, scope_of_work, start_date, next_visit_date, amount, estimate_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [id, user.id, est.customer_name, est.project_name, est.trade, args.data.frequency, args.data.scopeOfWork, start.toISOString().split("T")[0], nextVisit.toISOString().split("T")[0], total, args.data.estimateId]);
  await pool.query("UPDATE estimates SET contract_id = $1 WHERE id = $2", [id, args.data.estimateId]);
  return { id };
});

export const listContracts = makeAuthFn("contracts.listContracts", async (_args, userId, pool) => {
  return (await pool.query("SELECT c.*, (SELECT COUNT(*) FROM contract_visits WHERE contract_id = c.id) as visit_count, (SELECT COUNT(*) FROM contract_visits WHERE contract_id = c.id AND status = 'completed') as completed_visits FROM contracts c WHERE c.user_id = $1 ORDER BY c.updated_at DESC", [userId])).rows;
});

export const getContract = makeAuthFn("contracts.getContract", async (args: { data: { id: string } }, userId, pool) => {
  const cR = await pool.query("SELECT * FROM contracts WHERE id = $1 AND user_id = $2", [args.data.id, userId]);
  if (!cR.rows[0]) throw new Error("Not found");
  const visits = (await pool.query("SELECT * FROM contract_visits WHERE contract_id = $1 ORDER BY scheduled_date DESC", [args.data.id])).rows;
  return { contract: cR.rows[0], visits };
});

export const generateNextVisit = makeAuthFn("contracts.generateNextVisit", async (args: { data: { contractId: string } }, userId, pool) => {
  const cR = await pool.query("SELECT * FROM contracts WHERE id = $1 AND user_id = $2", [args.data.contractId, userId]);
  if (!cR.rows[0]) throw new Error("Not found");
  const contract = cR.rows[0];
  const freq = FREQUENCIES[contract.frequency] || FREQUENCIES.quarterly;
  const nextDate = new Date(contract.next_visit_date || contract.start_date);
  nextDate.setMonth(nextDate.getMonth() + freq.months);
  const nd = nextDate.toISOString().split("T")[0];
  await pool.query("UPDATE contracts SET next_visit_date = $1, updated_at = NOW() WHERE id = $2", [nd, args.data.contractId]);
  const visitId = crypto.randomUUID();
  await pool.query("INSERT INTO contract_visits (id, contract_id, scheduled_date) VALUES ($1,$2,$3)", [visitId, args.data.contractId, nd]);
  return { nextVisitDate: nd, visitId };
});

export const completeVisit = makeAuthFn("contracts.completeVisit", async (args: { data: { visitId: string; notes?: string } }, _userId, pool) => {
  await pool.query("UPDATE contract_visits SET status = 'completed', notes = $1, completed_at = NOW() WHERE id = $2", [args.data.notes || "", args.data.visitId]);
  return { success: true };
});

export const updateContractStatus = makeAuthFn("contracts.updateContractStatus", async (args: { data: { id: string; status: string } }, userId, pool) => {
  await pool.query("UPDATE contracts SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3", [args.data.status, args.data.id, userId]);
  return { success: true };
});

export const getUpcomingVisits = makeAuthFn("contracts.getUpcomingVisits", async (args: { data?: { days?: number } }, userId, pool) => {
  const days = args.data?.days || 30;
  return (await pool.query(`SELECT cv.*, c.customer_name, c.project_name, c.trade, c.frequency, c.amount FROM contract_visits cv JOIN contracts c ON c.id = cv.contract_id WHERE c.user_id = $1 AND cv.status = 'scheduled' AND cv.scheduled_date <= CURRENT_DATE + INTERVAL '${days} days' ORDER BY cv.scheduled_date`, [userId])).rows;
});

export const getExpiringContracts = makeAuthFn("contracts.getExpiringContracts", async (_args, userId, pool) => {
  return (await pool.query("SELECT * FROM contracts WHERE user_id = $1 AND status = 'active' AND end_date != '' AND end_date <= CURRENT_DATE + INTERVAL '30 days' ORDER BY end_date", [userId])).rows;
});
