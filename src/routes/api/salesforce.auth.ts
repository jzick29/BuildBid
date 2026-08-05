import { json, redirect } from "@tanstack/react-start";
import { storeSfToken } from "~/lib/salesforce";
import { getCookie } from "@tanstack/react-start/server";
import { getDb } from "~/lib/db.server";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    // Step 1: Redirect to Salesforce for authorization
    const clientId = process.env.SF_CLIENT_ID || "";
    const redirectUri = process.env.SF_REDIRECT_URI ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/api/salesforce/auth`
        : "http://localhost:3000/api/salesforce/auth");
    const authUrl = `https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=api refresh_token&state=buildbid`;
    return redirect(authUrl);
  }

  // Step 2: Exchange code for tokens
  const clientId = process.env.SF_CLIENT_ID || "";
  const clientSecret = process.env.SF_CLIENT_SECRET || "";
  const redirectUri = process.env.SF_REDIRECT_URI ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/salesforce/auth`
      : "http://localhost:3000/api/salesforce/auth");

  const tokenResp = await fetch("https://login.salesforce.com/services/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });
  const tokenBody = (await tokenResp.json()) as any;
  if (!tokenBody.access_token) {
    return json({ error: "Salesforce auth failed", details: tokenBody });
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
  await storeSfToken(
    session.user_id,
    tokenBody.access_token,
    tokenBody.refresh_token || "",
    tokenBody.instance_url
  );

  return redirect("/settings");
}
