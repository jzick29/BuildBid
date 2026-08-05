// POST /api/login — authenticates a user and creates a session
import { json } from "@tanstack/react-start";
import { login } from "~/lib/auth";

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const result = await login({ data: body });
    return json(result);
  } catch (e: any) {
    console.error("[api/login] Error:", e.message);
    return json({ error: e.message || "Login failed" }, { status: 400 });
  }
}

export const POST = action;
