import { json, redirect } from "@tanstack/react-start";
import { storeQboToken } from "~/lib/quickbooks";
import { getCookie } from "@tanstack/react-start/server";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");

  if (!code || !realmId) {
    const clientId = process.env.QBO_CLIENT_ID || "";
    const redirectUri = "https://site-delta-seven-64.vercel.app/api/qbo/auth";
    const scope = "com.intuit.quickbooks.accounting";
    const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=buildbid`;
    return redirect(authUrl);
  }

  const clientId = process.env.QBO_CLIENT_ID || "";
  const clientSecret = process.env.QBO_CLIENT_SECRET || "";
  const redirectUri = "https://site-delta-seven-64.vercel.app/api/qbo/auth";

  const resp = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  });
  const body = await resp.json() as any;

  if (!body.access_token) {
    return json({ error: "QBO auth failed", details: body });
  }

  const mod = await import("~/lib/db.server");
  const db = await mod.getDb();
  const token = getCookie("buildbid_session");
  if (!token) return json({ error: "Not logged in" }, { status: 401 });
  const session = db.query("SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime('now')").get(token) as any;
  if (!session) return json({ error: "Session expired" }, { status: 401 });

  await storeQboToken(session.user_id, body.access_token, body.refresh_token, realmId, body.expires_in || 3600);

  return redirect("/settings");
}
