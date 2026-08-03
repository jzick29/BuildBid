import { getPool } from "./pool";
import { makeAuthFnFull } from "./iso";

export const getTeamMembers = makeAuthFnFull("team.getTeamMembers", async (_args, user, pool) => {
  const memR = await pool.query("SELECT owner_id FROM team_members WHERE user_id = $1", [user.id]);
  const ownerId = memR.rows[0]?.owner_id || user.id;
  const members = (await pool.query("SELECT tm.*, u.email, u.name FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.owner_id = $1", [ownerId])).rows;
  const invites = (await pool.query("SELECT * FROM team_invites WHERE owner_id = $1 AND expires_at > NOW()", [ownerId])).rows;
  return { members, invites, ownerId, isOwner: ownerId === user.id };
});

export const inviteTeamMember = makeAuthFnFull("team.inviteTeamMember", async (args: { data: { email: string; role: string } }, user, pool) => {
  const tier = user.subscription_tier;
  const cntR = await pool.query("SELECT COUNT(*) as cnt FROM team_members WHERE owner_id = $1", [user.id]);
  const maxMembers = tier === "shop" ? 999 : tier === "pro" ? 5 : 0;
  if (tier === "trial" || tier === "starter") throw new Error("Team features require Pro or Shop plan");
  if (parseInt(cntR.rows[0].cnt) >= maxMembers) throw new Error(`Max ${maxMembers} team members on ${tier} plan`);
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  await pool.query("INSERT INTO team_invites (id, owner_id, email, role, token, expires_at) VALUES ($1,$2,$3,$4,$5,$6)",
    [crypto.randomUUID(), user.id, args.data.email, args.data.role, token, expiresAt]);
  return { token, inviteUrl: `/api/accept-invite?token=${token}` };
});

export const acceptInvite = makeAuthFnFull("team.acceptInvite", async (args: { data: { token: string } }, user, pool) => {
  const invR = await pool.query("SELECT * FROM team_invites WHERE token = $1 AND expires_at > NOW()", [args.data.token]);
  const invite = invR.rows[0];
  if (!invite) throw new Error("Invalid or expired invite");
  const existR = await pool.query("SELECT id FROM team_members WHERE owner_id = $1 AND user_id = $2", [invite.owner_id, user.id]);
  if (existR.rows[0]) return { already: true };
  await pool.query("INSERT INTO team_members (id, owner_id, user_id, role) VALUES ($1,$2,$3,$4)", [crypto.randomUUID(), invite.owner_id, user.id, invite.role]);
  await pool.query("DELETE FROM team_invites WHERE id = $1", [invite.id]);
  return { success: true };
});

export const removeTeamMember = makeAuthFnFull("team.removeTeamMember", async (args: { data: { memberId: string } }, user, pool) => {
  const mR = await pool.query("SELECT * FROM team_members WHERE id = $1", [args.data.memberId]);
  const member = mR.rows[0];
  if (!member) throw new Error("Member not found");
  if (member.owner_id !== user.id) throw new Error("Not your team");
  await pool.query("DELETE FROM team_members WHERE id = $1", [args.data.memberId]);
  return { success: true };
});

export const getTeamCount = makeAuthFnFull("team.getTeamCount", async (_args, user, pool) => {
  const mR = await pool.query("SELECT owner_id FROM team_members WHERE user_id = $1", [user.id]);
  const ownerId = mR.rows[0]?.owner_id || user.id;
  const cntR = await pool.query("SELECT COUNT(*) as cnt FROM team_members WHERE owner_id = $1", [ownerId]);
  return { count: parseInt(cntR.rows[0].cnt) + 1 };
});
