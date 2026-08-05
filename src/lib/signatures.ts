// Signatures module — digital signature capture for estimates/proposals
import { makeAuthFn } from "./iso";
import { getPool } from "./pool";

// Save a signature for an estimate
makeAuthFn("signatures.saveSignature", async (args: any, userId: string, pool: any) => {
  const { estimateId, signatureData, signedByName } = args.data || args;
  if (!estimateId || !signatureData) {
    throw new Error("estimateId and signatureData are required");
  }

  // Verify estimate belongs to user
  const est = await pool.query(
    "SELECT id FROM estimates WHERE id = $1 AND user_id = $2",
    [estimateId, userId]
  );
  if (!est.rows[0]) {
    throw new Error("Estimate not found");
  }

  // Check if signature already exists (upsert)
  const existing = await pool.query(
    "SELECT id FROM signatures WHERE estimate_id = $1",
    [estimateId]
  );

  if (existing.rows[0]) {
    await pool.query(
      `UPDATE signatures 
       SET signature_data = $1, signed_by_name = $2, signed_at = NOW() 
       WHERE estimate_id = $3`,
      [signatureData, signedByName || null, estimateId]
    );
  } else {
    await pool.query(
      `INSERT INTO signatures (estimate_id, user_id, signature_data, signed_by_name) 
       VALUES ($1, $2, $3, $4)`,
      [estimateId, userId, signatureData, signedByName || null]
    );
  }

  return { success: true };
});

// Get signature for an estimate
makeAuthFn("signatures.getSignature", async (args: any, userId: string, pool: any) => {
  const { estimateId } = args.data || args;
  if (!estimateId) {
    throw new Error("estimateId is required");
  }

  const result = await pool.query(
    "SELECT id, signature_data, signed_by_name, signed_at FROM signatures WHERE estimate_id = $1",
    [estimateId]
  );

  return {
    signature: result.rows[0] || null,
  };
});
