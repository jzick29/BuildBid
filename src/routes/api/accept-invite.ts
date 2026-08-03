import { redirect } from "@tanstack/react-router";
import { acceptInvite } from "~/lib/team";
import { getCookie } from "@tanstack/react-start/server";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Missing invite token", { status: 400 });
  }

  const mod = await import("~/lib/db.server");
  const db = await mod.getDb();
  const sessionToken = getCookie("buildbid_session");
  const session = sessionToken ? db.query("SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime('now')").get(sessionToken) as any : null;

  if (!session) {
    // Redirect to signup with the invite token
    return redirect(`/signup?invite=${encodeURIComponent(token)}`);
  }

  try {
    await acceptInvite({ data: { token } });
    return redirect("/team");
  } catch(e: any) {
    return new Response(e.message || "Failed to accept invite", { status: 400 });
  }
}
