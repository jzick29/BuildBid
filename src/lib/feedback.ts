import { makeAuthFn } from "./iso";

export const submitFeedback = makeAuthFn("feedback.submitFeedback", async (args: { data: { message: string; rating?: number } }, userId, pool) => {
  const id = crypto.randomUUID();
  await pool.query("INSERT INTO feedback (id, user_id, message, rating) VALUES ($1, $2, $3, $4)", [id, userId, args.data.message, args.data.rating || 0]);
  return { success: true };
});
