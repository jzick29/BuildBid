import { makeAuthFn } from "./iso";
import type { Pool } from "@neondatabase/serverless";

export const getCustomerList = makeAuthFn("customers.getCustomerList", async (_args: any, userId: string, pool: Pool) => {
  const result = await pool.query(
    `SELECT customer_name,
       COUNT(*) as total_estimates,
       SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won,
       SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost,
       MAX(updated_at) as last_bid,
       SUM(CASE WHEN status = 'won' THEN (SELECT SUM(l.quantity * l.unit_cost * (1 + l.markup_percent / 100)) FROM line_items l WHERE l.estimate_id = e.id) ELSE 0 END) as total_revenue
     FROM estimates e
     WHERE e.user_id = $1
     GROUP BY customer_name
     ORDER BY last_bid DESC`,
    [userId]
  );
  return result.rows;
});
