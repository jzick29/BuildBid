import { makeAuthFn } from "./iso";
import type { Pool } from "@neondatabase/serverless";

// Self-migrating: runs on first query to ensure the photos table exists
let migrated = false;
async function ensureTable(pool: Pool) {
  if (migrated) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      caption TEXT DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_photos_estimate ON photos(estimate_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_photos_user ON photos(user_id)`);
  migrated = true;
}

// Presigned URL generation — called from server to get upload URL
export const getPresignedUrl = makeAuthFn("photos.getPresignedUrl", async (args: { data: { filename: string; contentType: string; contentLength: number; estimateId: string } }, userId: string, _pool: Pool) => {
  await ensureTable(_pool);
  const presignUrl = process.env.IMAGE_UPLOAD_PRESIGN_URL;
  const token = process.env.IMAGE_UPLOAD_TOKEN;
  if (!presignUrl || !token) throw new Error("Image upload not configured");

  const res = await fetch(presignUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: args.data.filename,
      mediaType: args.data.contentType,
      contentLength: args.data.contentLength,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to get presigned URL");
  }
  const data = await res.json();
  const uploadUrl = data.uploadUrl || data.url;
  const publicUrl = data.publicUrl || data.url;
  return { uploadUrl, publicUrl };
});

// Save photo metadata after successful upload
export const savePhoto = makeAuthFn("photos.savePhoto", async (args: { data: { estimateId: string; url: string; caption?: string } }, userId: string, pool: Pool) => {
  await ensureTable(pool);
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO photos (id, user_id, estimate_id, url, caption, created_at) VALUES ($1,$2,$3,$4,$5,NOW())`,
    [id, userId, args.data.estimateId, args.data.url, args.data.caption || ""]
  );
  const r = await pool.query("SELECT id, estimate_id, url, caption, created_at FROM photos WHERE id = $1", [id]);
  return r.rows[0] || { id };
});

// List photos for an estimate
export const getPhotosByEstimate = makeAuthFn("photos.getPhotosByEstimate", async (args: { data: { estimateId: string } }, userId: string, pool: Pool) => {
  await ensureTable(pool);
  const r = await pool.query(
    "SELECT id, estimate_id as \"estimateId\", url, caption, created_at FROM photos WHERE estimate_id = $1 ORDER BY created_at DESC",
    [args.data.estimateId]
  );
  return (r.rows || []).map((row: any) => ({
    ...row,
    created_at: row.created_at ? String(row.created_at) : "",
  }));
});

// Delete a photo
export const deletePhoto = makeAuthFn("photos.deletePhoto", async (args: { data: { id: string } }, userId: string, pool: Pool) => {
  await ensureTable(pool);
  await pool.query("DELETE FROM photos WHERE id = $1 AND user_id = $2", [args.data.id, userId]);
  return { success: true };
});
