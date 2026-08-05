import { json } from "@tanstack/react-start";

export async function loader({ params }: { params: { estimateId: string } }) {
  const mod = await import("~/lib/db.server");
  const db = await mod.getDb();
  const id = crypto.randomUUID();
  db.run("INSERT INTO proposal_views (id, estimate_id) VALUES (?, ?)", [id, params.estimateId]);
  const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
