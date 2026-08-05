import { json, redirect } from "@tanstack/react-start";
import { storeHubspotToken } from "~/lib/hubspot";
import { getCookie } from "@tanstack/react-start/server";
import { getDb } from "~/lib/db.server";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    // Step 1: Redirect to HubSpot for authorization
    const clientId = process.env.HUBSPOT_CLIENT_ID || "";
    const redirectUri = process.env.HUBSPOT_REDIRECT_URI ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/api/hubspot/auth`
        : "http://localhost:3000/api/hubspot/auth");
    const scope = "crm.objects.deals.read crm.objects.deals.write crm.objects.contacts.read crm.objects.contacts.write oauth";
    const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=buildbid`;
    return redirect(authUrl);
  }

  // Step 2: Exchange code for tokens
  const clientId = process.env.HUBSPOT_CLIENT_ID || "";
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET || "";
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/hubspot/auth`
      : "http://localhost:3000/api/hubspot/auth");

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const tokenResp = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const tokenBody = (await tokenResp.json()) as any;
  if (!tokenBody.access_token) {
    return json({ error: "HubSpot auth failed", details: tokenBody });
  }

  // Step 3: Resolve user from session cookie
  const db = await getDb();
  const sessionToken = getCookie("buildbid_session");
  if (!sessionToken) return json({ error: "Not logged in" }, { status: 401 });

  const session = db.query(
    "SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime('now')"
  ).get(sessionToken) as any;
  if (!session) return json({ error: "Session expired" }, { status: 401 });

  // Step 4: Store token
  await storeHubspotToken(
    session.user_id,
    tokenBody.access_token,
    tokenBody.refresh_token,
    tokenBody.expires_in || 1800
  );

  return redirect("/settings");
}
