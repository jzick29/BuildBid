import { makeAuthFn } from "./iso";
import type { Pool } from "@neondatabase/serverless";

export const uploadPhoto = makeAuthFn("photos.uploadPhoto", async (args: { data: { lineItemId: string; filename: string; photoData: string } }, userId: string, pool: Pool) => {
  const id = crypto.randomUUID();
  await pool.query("INSERT INTO line_item_photos (id, line_item_id, filename, photo_data) VALUES ($1,$2,$3,$4)",
    [id, args.data.lineItemId, args.data.filename, args.data.photoData]);
  return { id };
});

export const getPhotosByEstimate = makeAuthFn("photos.getPhotosByEstimate", async (args: { data: { estimateId: string } }, userId: string, pool: Pool) => {
  const r = await pool.query(
    "SELECT lp.id, lp.line_item_id, lp.filename, lp.photo_data, lp.created_at FROM line_item_photos lp JOIN line_items li ON li.id = lp.line_item_id WHERE li.estimate_id = $1 ORDER BY lp.created_at DESC",
    [args.data.estimateId]
  );
  return r.rows;
});

export const deletePhoto = makeAuthFn("photos.deletePhoto", async (args: { data: { id: string } }, userId: string, pool: Pool) => {
  await pool.query("DELETE FROM line_item_photos WHERE id = $1", [args.data.id]);
  return { success: true };
});
