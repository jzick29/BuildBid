import { makePublicFn } from "./iso";
import type { Pool } from "@neondatabase/serverless";

export const getBlogStats = makePublicFn("blog.getBlogStats", async (_args: any, pool: Pool) => {
  const result = await pool.query("SELECT COUNT(*) as count FROM estimates");
  return { estimateCount: parseInt(result.rows[0]?.count) || 0 };
});
