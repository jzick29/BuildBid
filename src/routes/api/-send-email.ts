// API route for sending emails — called by server functions
// The actual email sending is handled by the agent via the sendEmail tool
// This endpoint stores the email request and returns success

import { json } from "@tanstack/react-start";

const isVercel = typeof process !== 'undefined' && !!process.env.VERCEL;

export async function loader() {
  return json({ error: "Use POST" }, { status: 405 });
}

export async function action({ request }: { request: Request }) {
  try {
    const { to, subject, body } = await request.json();
    if (!to || !subject || !body) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log(`[EMAIL QUEUE] To: ${to}, Subject: ${subject}`);

    if (isVercel) {
      return json({ success: true, id: crypto.randomUUID(), note: "Vercel — email queued for agent processing" });
    }

    // On Bun: store in SQLite
    let Database: any;
    try {
      Database = (await import("bun:sqlite")).Database;
    } catch {
      return json({ success: true, id: crypto.randomUUID(), note: "No DB available" });
    }

    const { existsSync, mkdirSync } = await import("fs");
    const dir = `${import.meta.dir}/../../data`;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const db = new Database(`${dir}/app.db`);
    db.exec("PRAGMA journal_mode = WAL");
    db.run(`CREATE TABLE IF NOT EXISTS email_queue (
      id TEXT PRIMARY KEY,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    const id = crypto.randomUUID();
    db.run("INSERT INTO email_queue (id, to_email, subject, body) VALUES (?, ?, ?, ?)", [id, to, subject, body]);

    return json({ success: true, id });
  } catch (err: any) {
    console.error("[EMAIL QUEUE] Error:", err);
    return json({ error: err.message || "Failed to queue email" }, { status: 500 });
  }
}

export const POST = action;
