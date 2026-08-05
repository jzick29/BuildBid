import { json, redirect } from "@tanstack/react-start";
import { storeXeroToken } from "~/lib/xero";
import { getCookie } from "@tanstack/react-start/server";
import { getDb } from "~/lib/db.server";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    // Step 1: Redirect to Xero for authorization
    const clientId = process.env.XERO_CLIENT_ID || "";
    const redirectUri = process.env.XERO_REDIRECT_URI ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/api/xero/auth`
        : "http://localhost:3000/api/xero/auth");
    const scope = "openid profile email accounting.transactions accounting.contacts offline_access";
    const authUrl = `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=buildbid`;
    return redirect(authUrl);
  }

  // Step 2: Exchange code for tokens
  const clientId = process.env.XERO_CLIENT_ID || "";
  const clientSecret = process.env.XERO_CLIENT_SECRET || "";
  const redirectUri = process.env.XERO_REDIRECT_URI ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/xero/auth`
      : "http://localhost:3000/api/xero/auth");

  const tokenResp = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenBody = (await tokenResp.json()) as any;
  if (!tokenBody.access_token) {
    return json({ error: "Xero auth failed", details: tokenBody });
  }

  // Step 3: Get tenant/connections
  const connResp = await fetch("https://api.xero.com/connections", {
    headers: { Authorization: `Bearer ${tokenBody.access_token}`, Accept: "application/json" },
  });
  const connections = (await connResp.json()) as any[];
  if (!connections || connections.length === 0) {
    return json({ error: "No Xero organisations found" }, { status: 400 });
  }
  const tenantId = connections[0].tenantId;

  // Step 4: Resolve user from session cookie
  const db = await getDb();
  const token = getCookie("buildbid_session");
  if (!token) return json({ error: "Not logged in" }, { status: 401 });

  const session = db.query(
    "SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime('now')"
  ).get(token) as any;
  if (!session) return json({ error: "Session expired" }, { status: 401 });

  // Step 5: Store token
  await storeXeroToken(
    session.user_id,
    tokenBody.access_token,
    tokenBody.refresh_token,
    tenantId,
    tokenBody.expires_in || 1800
  );

  return redirect("/settings");
}
