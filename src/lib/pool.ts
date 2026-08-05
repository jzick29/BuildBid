// Shared Postgres pool helper — used by .server() functions in isomorphic fns
import { Pool } from "@neondatabase/serverless";

export function getPool(): Pool {
  const g = globalThis as any;
  if (g.__buildbid_pool) return g.__buildbid_pool as Pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const pool = new Pool({ connectionString: url, max: 3 });
  g.__buildbid_pool = pool;
  return pool;
}
