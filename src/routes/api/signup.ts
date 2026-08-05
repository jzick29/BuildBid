// POST /api/signup — creates a new user account
import { json } from "@tanstack/react-start";
import { signup } from "~/lib/auth";

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const result = await signup({ data: body });
    return json(result);
  } catch (e: any) {
    console.error("[api/signup] Error:", e.message);
    return json({ error: e.message || "Signup failed" }, { status: 400 });
  }
}

export const POST = action;
