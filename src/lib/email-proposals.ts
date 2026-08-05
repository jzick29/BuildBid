import { makeAuthFn } from "./iso";
import type { Pool } from "@neondatabase/serverless";

export const emailProposal = makeAuthFn("emailProposals.emailProposal", async (args: { data: { proposalId: string; toEmail: string; subject: string; message: string } }, userId: string, pool: Pool) => {
  await pool.query("UPDATE proposals SET sent_to_email = $1, sent_at = NOW() WHERE id = $2", [args.data.toEmail, args.data.proposalId]);
  return { success: true };
});
