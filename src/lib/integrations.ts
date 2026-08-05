import { makeAuthFn, makeAuthFnFull } from "./iso";

const BUILDER_PLATFORMS: Record<string, { name: string; authUrl: string; tokenUrl: string; apiUrl: string }> = {
  buildertrend: { name: "Buildertrend", authUrl: "https://buildertrend.com/oauth2/authorize", tokenUrl: "https://api.buildertrend.com/v1/oauth2/token", apiUrl: "https://api.buildertrend.com/v1" },
  coconstruct: { name: "CoConstruct", authUrl: "https://api.coconstruct.com/oauth/authorize", tokenUrl: "https://api.coconstruct.com/oauth/token", apiUrl: "https://api.coconstruct.com/v1" },
  procore: { name: "Procore", authUrl: "https://login.procore.com/oauth/authorize", tokenUrl: "https://login.procore.com/oauth/token", apiUrl: "https://api.procore.com/rest/v1.0" },
};

export const getConnectionUrl = makeAuthFnFull("integrations.getConnectionUrl", async (args: { data: { platform: string } }, user, _pool) => {
  const platform = BUILDER_PLATFORMS[args.data.platform];
  if (!platform) throw new Error("Unknown platform");
  const clientId = process.env[`${args.data.platform.toUpperCase()}_CLIENT_ID`];
  if (!clientId) throw new Error(`${platform.name} not configured`);
  const redirectUri = `${process.env.APP_URL || "https://site-delta-seven-64.vercel.app"}/api/builder-auth?platform=${args.data.platform}`;
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", state: user.id, scope: "read write" });
  return { url: `${platform.authUrl}?${params.toString()}` };
});

export const getConnectedPlatforms = makeAuthFn("integrations.getConnectedPlatforms", async (_args, userId, pool) => {
  return (await pool.query("SELECT platform, expires_at, created_at FROM builder_integrations WHERE user_id = $1", [userId])).rows.map((r: any) => ({ platform: r.platform, name: BUILDER_PLATFORMS[r.platform]?.name || r.platform, connectedAt: r.created_at, expiresAt: r.expires_at }));
});

export const disconnectPlatform = makeAuthFn("integrations.disconnectPlatform", async (args: { data: { platform: string } }, userId, pool) => {
  await pool.query("DELETE FROM builder_integrations WHERE user_id = $1 AND platform = $2", [userId, args.data.platform]);
  return { success: true };
});

export const importBidsFromPlatform = makeAuthFn("integrations.importBidsFromPlatform", async (args: { data: { platform: string } }, userId, pool) => {
  const tokR = await pool.query("SELECT access_token, realm_id FROM builder_integrations WHERE user_id = $1 AND platform = $2", [userId, args.data.platform]);
  if (!tokR.rows[0]) throw new Error("Not connected to this platform");
  const token = tokR.rows[0];
  const platform = BUILDER_PLATFORMS[args.data.platform];
  if (!platform) throw new Error("Unknown platform");
  const resp = await fetch(`${platform.apiUrl}/bids?status=open`, { headers: { Authorization: `Bearer ${token.access_token}`, "BT-Realm-Id": token.realm_id || "" } });
  if (!resp.ok) throw new Error(`Failed to fetch bids: ${resp.status}`);
  const bids = (await resp.json()) as any[];
  let imported = 0;
  for (const bid of bids) {
    const existR = await pool.query("SELECT id FROM estimates WHERE user_id = $1 AND project_name = $2 AND customer_name = $3", [userId, bid.job_name || bid.name, bid.customer_name || bid.contact_name || ""]);
    if (!existR.rows[0]) {
      await pool.query("INSERT INTO estimates (id, user_id, project_name, customer_name, trade, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)", [crypto.randomUUID(), userId, bid.job_name || bid.name, bid.customer_name || bid.contact_name || "", "general_contractor", "draft", `Imported from ${platform.name}. Bid #${bid.number || bid.id}`]);
      imported++;
    }
  }
  return { imported, total: bids.length };
});

export const exportProposalToPlatform = makeAuthFn("integrations.exportProposalToPlatform", async (args: { data: { estimateId: string; platform: string } }, userId, pool) => {
  const tokR = await pool.query("SELECT access_token, realm_id FROM builder_integrations WHERE user_id = $1 AND platform = $2", [userId, args.data.platform]);
  if (!tokR.rows[0]) throw new Error("Not connected to this platform");
  const token = tokR.rows[0];
  const estR = await pool.query("SELECT * FROM estimates WHERE id = $1 AND user_id = $2", [args.data.estimateId, userId]);
  if (!estR.rows[0]) throw new Error("Estimate not found");
  const est = estR.rows[0];
  const items = (await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [args.data.estimateId])).rows;
  const total = items.reduce((s: number, i: any) => s + i.quantity * i.unit_cost * (1 + i.markup_percent / 100), 0);
  const platformCfg = BUILDER_PLATFORMS[args.data.platform];
  if (!platformCfg) throw new Error("Unknown platform");
  const resp = await fetch(`${platformCfg.apiUrl}/bids`, { method: "POST", headers: { Authorization: `Bearer ${token.access_token}`, "BT-Realm-Id": token.realm_id || "", "Content-Type": "application/json" }, body: JSON.stringify({ job_name: est.project_name, amount: total, description: est.notes || "", status: "submitted", line_items: items.map((i: any) => ({ description: i.description, quantity: i.quantity, unit: i.unit, unit_price: i.unit_cost, total: i.quantity * i.unit_cost * (1 + i.markup_percent / 100) })) }) });
  if (!resp.ok) { const err = await resp.text(); throw new Error(`Failed to export: ${resp.status} — ${err}`); }
  await pool.query("UPDATE estimates SET status = 'submitted', updated_at = NOW() WHERE id = $1", [args.data.estimateId]);
  return { success: true };
});
