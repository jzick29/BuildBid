import { createServerFn } from "@tanstack/react-start";

export const handleBuilderAuth = createServerFn({ method: "GET" })
  .handler(async ({ data: rawData }) => {
    const url = new URL(rawData?.toString() || "");
    const code = url.searchParams.get("code");
    const platform = url.searchParams.get("platform");
    const state = url.searchParams.get("state"); // user_id
    
    if (!code || !platform || !state) {
      return new Response("Missing parameters", { status: 400 });
    }
    
    const platformConfigs: Record<string, { tokenUrl: string; clientId: string; clientSecret: string }> = {
      buildertrend: {
        tokenUrl: "https://api.buildertrend.com/v1/oauth2/token",
        clientId: process.env.BUILDERTREND_CLIENT_ID || "",
        clientSecret: process.env.BUILDERTREND_CLIENT_SECRET || "",
      },
      coconstruct: {
        tokenUrl: "https://api.coconstruct.com/oauth/token",
        clientId: process.env.COCONSTRUCT_CLIENT_ID || "",
        clientSecret: process.env.COCONSTRUCT_CLIENT_SECRET || "",
      },
      procore: {
        tokenUrl: "https://login.procore.com/oauth/token",
        clientId: process.env.PROCORE_CLIENT_ID || "",
        clientSecret: process.env.PROCORE_CLIENT_SECRET || "",
      },
    };
    
    const config = platformConfigs[platform];
    if (!config || !config.clientId) {
      return new Response(`${platform} not configured`, { status: 500 });
    }
    
    try {
      const redirectUri = `${process.env.APP_URL || "https://site-delta-seven-64.vercel.app"}/api/builder-auth?platform=${platform}`;
      const resp = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
      });
      
      if (!resp.ok) {
        return new Response(`OAuth failed: ${await resp.text()}`, { status: 500 });
      }
      
      const json = await resp.json() as any;
      const mod = await import("../lib/db.server");
      const db = await mod.getDb();
      const id = crypto.randomUUID();
      const expiresAt = json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : null;
      
      // Upsert integration
      const existing = db.query(
        "SELECT id FROM builder_integrations WHERE user_id = ? AND platform = ?"
      ).get(state, platform) as any;
      
      if (existing) {
        db.run(
          "UPDATE builder_integrations SET access_token = ?, refresh_token = ?, realm_id = ?, expires_at = ?, updated_at = datetime('now') WHERE id = ?",
          [json.access_token, json.refresh_token || "", json.realm_id || "", expiresAt, existing.id]
        );
      } else {
        db.run(
          "INSERT INTO builder_integrations (id, user_id, platform, access_token, refresh_token, realm_id, expires_at) VALUES (?,?,?,?,?,?,?)",
          [id, state, platform, json.access_token, json.refresh_token || "", json.realm_id || "", expiresAt]
        );
      }
      
      return new Response(null, {
        status: 302,
        headers: { Location: "/integrations?connected=" + platform },
      });
    } catch (e: any) {
      return new Response(`OAuth error: ${e.message}`, { status: 500 });
    }
  });
