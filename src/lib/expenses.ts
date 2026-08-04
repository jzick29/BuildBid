// Expenses module — job-level expense/receipt tracking for actual-vs-estimated cost comparison
import { makeAuthFn } from "./iso";
import { getPool } from "./pool";

// List expenses for an estimate
makeAuthFn("expenses.listExpenses", async (args: any, userId: string, pool: any) => {
  const { estimateId } = args.data || args;
  if (!estimateId) throw new Error("estimateId is required");

  const result = await pool.query(
    `SELECT id, description, amount, category, vendor, expense_date, receipt_url, notes, created_at
     FROM expenses
     WHERE estimate_id = $1 AND user_id = $2
     ORDER BY expense_date DESC, created_at DESC`,
    [estimateId, userId]
  );

  return { expenses: result.rows };
});

// Create a new expense
makeAuthFn("expenses.createExpense", async (args: any, userId: string, pool: any) => {
  const { estimateId, description, amount, category, vendor, expenseDate, receiptUrl, notes } = args.data || args;
  if (!estimateId) throw new Error("estimateId is required");
  if (!amount || parseFloat(amount) <= 0) throw new Error("amount must be positive");

  // Verify estimate ownership
  const est = await pool.query(
    "SELECT id FROM estimates WHERE id = $1 AND user_id = $2",
    [estimateId, userId]
  );
  if (!est.rows[0]) throw new Error("Estimate not found");

  const result = await pool.query(
    `INSERT INTO expenses (estimate_id, user_id, description, amount, category, vendor, expense_date, receipt_url, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, description, amount, category, vendor, expense_date, receipt_url, notes, created_at`,
    [
      estimateId,
      userId,
      description || "",
      amount,
      category || "materials",
      vendor || "",
      expenseDate || new Date().toISOString().slice(0, 10),
      receiptUrl || null,
      notes || "",
    ]
  );

  return { expense: result.rows[0] };
});

// Delete an expense
makeAuthFn("expenses.deleteExpense", async (args: any, userId: string, pool: any) => {
  const { id } = args.data || args;
  if (!id) throw new Error("id is required");

  const result = await pool.query(
    "DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId]
  );

  if (!result.rows[0]) throw new Error("Expense not found");
  return { success: true };
});

// Get expense summary — actual by category + estimated total comparison
makeAuthFn("expenses.getExpenseSummary", async (args: any, userId: string, pool: any) => {
  const { estimateId } = args.data || args;
  if (!estimateId) throw new Error("estimateId is required");

  // Total actual expenses
  const totalResult = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(*) as expense_count
     FROM expenses
     WHERE estimate_id = $1 AND user_id = $2`,
    [estimateId, userId]
  );

  // Expenses by category
  const catResult = await pool.query(
    `SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
     FROM expenses
     WHERE estimate_id = $1 AND user_id = $2
     GROUP BY category
     ORDER BY total DESC`,
    [estimateId, userId]
  );

  // Get estimated total from line items
  const estResult = await pool.query(
    `SELECT COALESCE(SUM(quantity * (unit_cost + (unit_cost * markup_pct / 100.0))), 0) as estimated_total
     FROM line_items
     WHERE estimate_id = $1`,
    [estimateId]
  );

  const summary = totalResult.rows[0];
  const estTotal = parseFloat(estResult.rows[0]?.estimated_total || "0");

  return {
    totalExpenses: parseFloat(summary.total_expenses),
    expenseCount: parseInt(summary.expense_count),
    estimatedTotal: estTotal,
    variance: estTotal - parseFloat(summary.total_expenses),
    byCategory: catResult.rows.map((r: any) => ({
      category: r.category,
      total: parseFloat(r.total),
      count: parseInt(r.count),
    })),
  };
});
