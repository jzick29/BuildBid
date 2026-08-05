import { makeAuthFn } from "./iso";

// ─── Google Calendar integration ─────────────────────────────────────
// OAuth2 (Authorization Code + PKCE-lite) against Google Calendar API v3.
// Tokens stored in google_tokens; synced events in calendar_events.
// Requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars to activate.

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_API = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

function appUrl(): string {
  return process.env.APP_URL || "https://buildbid.pro";
}

// ─── Plain helpers (imported by vercel-entry.ts directly) ────────────

export async function getGoogleToken(userId: string, pool: any) {
  const r = await pool.query("SELECT * FROM google_tokens WHERE user_id = $1", [userId]);
  return r.rows[0] || null;
}

export async function storeGoogleToken(userId: string, accessToken: string, refreshToken: string, expiresIn: number, calendarId: string | null, pool: any) {
  const expiresAt = new Date(Date.now() + (expiresIn || 3600) * 1000).toISOString();
  const exist = await pool.query("SELECT user_id FROM google_tokens WHERE user_id = $1", [userId]);
  const cal = calendarId || "primary";
  if (exist.rows[0]) {
    await pool.query(
      "UPDATE google_tokens SET access_token=$1, refresh_token=$2, calendar_id=$3, expires_at=$4, updated_at=NOW() WHERE user_id=$5",
      [accessToken, refreshToken, cal, expiresAt, userId]
    );
  } else {
    await pool.query(
      "INSERT INTO google_tokens (user_id, access_token, refresh_token, calendar_id, expires_at) VALUES ($1,$2,$3,$4,$5)",
      [userId, accessToken, refreshToken, cal, expiresAt]
    );
  }
}

/** Exchange an OAuth authorization code for tokens. Used by the /api/google-oauth callback. */
export async function exchangeGoogleCode(code: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google Calendar not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)");
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${appUrl()}/api/google-oauth`,
    grant_type: "authorization_code",
  });
  const resp = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Google token exchange failed: ${JSON.stringify(data)}`);
  return { accessToken: data.access_token as string, refreshToken: (data.refresh_token as string) || "", expiresIn: data.expires_in as number };
}

/** Refresh an expired access token using the stored refresh token. */
export async function refreshGoogleToken(userId: string, pool: any): Promise<string> {
  const tok = await getGoogleToken(userId, pool);
  if (!tok) throw new Error("Google Calendar not connected");
  if (tok.refresh_token && new Date(tok.expires_at) <= new Date()) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Google Calendar not configured");
    const body = new URLSearchParams({
      refresh_token: tok.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    });
    const resp = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
    const data = await resp.json();
    if (!resp.ok || !data.access_token) throw new Error(`Google token refresh failed: ${JSON.stringify(data)}`);
    await storeGoogleToken(userId, data.access_token, tok.refresh_token, data.expires_in || 3600, tok.calendar_id, pool);
    return data.access_token;
  }
  return tok.access_token;
}

/** Create an event on the user's primary Google Calendar. Returns { id, htmlLink }. */
export async function createGoogleEvent(pool: any, userId: string, event: { summary: string; description?: string; start: string; end: string; location?: string }) {
  const accessToken = await refreshGoogleToken(userId, pool);
  const tok = await getGoogleToken(userId, pool);
  const calendarId = tok?.calendar_id || "primary";
  const payload = {
    summary: event.summary,
    description: event.description || "",
    location: event.location || "",
    start: { dateTime: event.start },
    end: { dateTime: event.end },
  };
  const resp = await fetch(`${GOOGLE_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Google Calendar error: ${data.error?.message || JSON.stringify(data)}`);
  return { id: data.id as string, htmlLink: data.htmlLink as string };
}

/** Delete an event from the user's Google Calendar (idempotent). */
export async function deleteGoogleEvent(pool: any, userId: string, googleEventId: string) {
  try {
    const accessToken = await refreshGoogleToken(userId, pool);
    const tok = await getGoogleToken(userId, pool);
    const calendarId = tok?.calendar_id || "primary";
    await fetch(`${GOOGLE_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e: any) {
    console.error("[google-calendar] delete failed:", e?.message || e);
  }
}

/** Build an ICS file for an estimate — used as a fallback when Google isn't connected. */
export function buildIcs(summary: string, description: string, location: string, start: string, end: string, uid: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BuildBid//Estimate//EN",
    "BEGIN:VEVENT",
    `UID:${uid}@buildbid`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${summary.replace(/,/g, "\\,")}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, "\\n").replace(/,/g, "\\,")}` : "",
    location ? `LOCATION:${location.replace(/,/g, "\\,")}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

/** Default event window for an estimate (start_date/end_date or next business day 8am-5pm). */
export function estimateEventWindow(estimate: any): { start: string; end: string } {
  if (estimate?.start_date) {
    const s = new Date(estimate.start_date.length <= 10 ? `${estimate.start_date}T08:00:00` : estimate.start_date);
    const e = estimate.end_date
      ? new Date(estimate.end_date.length <= 10 ? `${estimate.end_date}T17:00:00` : estimate.end_date)
      : new Date(s.getTime() + 9 * 3600000);
    return { start: s.toISOString(), end: e.toISOString() };
  }
  const s = new Date(Date.now() + 86400000);
  s.setHours(8, 0, 0, 0);
  const e = new Date(s.getTime() + 9 * 3600000);
  return { start: s.toISOString(), end: e.toISOString() };
}

// ─── API handlers ────────────────────────────────────────────────────

// calendar.getStatus — connection state + synced events
export const getCalendarStatus = makeAuthFn("calendar.getStatus", async (_args, userId, pool) => {
  const tok = await getGoogleToken(userId, pool);
  const events = (await pool.query(
    "SELECT ce.*, e.project_name, e.customer_name FROM calendar_events ce LEFT JOIN estimates e ON e.id = ce.estimate_id WHERE ce.user_id = $1 ORDER BY ce.event_start DESC LIMIT 50",
    [userId]
  )).rows;
  return { connected: !!tok, connectedAt: tok?.created_at || null, calendarId: tok?.calendar_id || null, events };
});

// calendar.getAuthUrl — build OAuth2 authorization URL
export const getCalendarAuthUrl = makeAuthFn("calendar.getAuthUrl", async (_args, userId, pool) => {
  const tierR = await pool.query("SELECT subscription_tier FROM users WHERE id = $1", [userId]);
  const tier = tierR.rows[0]?.subscription_tier || "trial";
  if (tier !== "pro" && tier !== "shop") throw new Error("Google Calendar sync requires the Pro or Shop plan");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("Google Calendar not configured yet — add GOOGLE_CLIENT_ID to enable");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl()}/api/google-oauth`,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: userId,
  });
  return { url: `${GOOGLE_AUTH_URL}?${params.toString()}` };
});

// calendar.disconnect — remove tokens + locally synced events
export const disconnectCalendar = makeAuthFn("calendar.disconnect", async (_args, userId, pool) => {
  await pool.query("DELETE FROM google_tokens WHERE user_id = $1", [userId]);
  await pool.query("DELETE FROM calendar_events WHERE user_id = $1", [userId]);
  return { success: true };
});

// calendar.getEvents — synced events for an estimate
export const getCalendarEvents = makeAuthFn("calendar.getEvents", async (args: { data: { estimateId?: string } }, userId, pool) => {
  if (args.data?.estimateId) {
    return (await pool.query("SELECT * FROM calendar_events WHERE user_id = $1 AND estimate_id = $2 ORDER BY event_start", [userId, args.data.estimateId])).rows;
  }
  return (await pool.query("SELECT * FROM calendar_events WHERE user_id = $1 ORDER BY event_start DESC LIMIT 100", [userId])).rows;
});

// calendar.createEvent — create an event for an estimate ("Add to Calendar")
export const createCalendarEvent = makeAuthFn(
  "calendar.createEvent",
  async (args: { data: { estimateId: string; start?: string; end?: string } }, userId, pool) => {
    const d = args.data || {};
    const estR = await pool.query("SELECT * FROM estimates WHERE id = $1 AND user_id = $2", [d.estimateId, userId]);
    const est = estR.rows[0];
    if (!est) throw new Error("Estimate not found");
    const win = d.start && d.end ? { start: new Date(d.start).toISOString(), end: new Date(d.end).toISOString() } : estimateEventWindow(est);
    const summary = `${est.project_name} — ${est.customer_name || ""}`.trim();
    const description = `BuildBid job: ${est.project_name} (${est.trade || "general"}) for ${est.customer_name || "customer"}. ${est.notes || ""}`.trim();
    const tok = await getGoogleToken(userId, pool);
    if (!tok) {
      // No Google connection — return an .ics file so the button still works
      return { success: true, method: "ics", ics: buildIcs(summary, description, "", win.start, win.end, crypto.randomUUID()) };
    }
    const created = await createGoogleEvent(pool, userId, { summary, description, start: win.start, end: win.end });
    await pool.query(
      "INSERT INTO calendar_events (id, user_id, estimate_id, google_event_id, summary, event_start, event_end) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [crypto.randomUUID(), userId, est.id, created.id, summary, win.start, win.end]
    );
    return { success: true, method: "google", googleEventId: created.id, htmlLink: created.htmlLink };
  }
);

// calendar.deleteEvent — remove a synced event (Google + local)
export const deleteCalendarEvent = makeAuthFn("calendar.deleteEvent", async (args: { data: { eventId: string } }, userId, pool) => {
  const r = await pool.query("SELECT * FROM calendar_events WHERE id = $1 AND user_id = $2", [args.data.eventId, userId]);
  const ev = r.rows[0];
  if (!ev) throw new Error("Event not found");
  if (ev.google_event_id) await deleteGoogleEvent(pool, userId, ev.google_event_id);
  await pool.query("DELETE FROM calendar_events WHERE id = $1 AND user_id = $2", [args.data.eventId, userId]);
  return { success: true };
});

// calendar.syncScheduled — auto-create events for jobs being scheduled (batch)
// Called from estimates.updateEstimateStatus when status → 'scheduled'.
export async function autoSyncScheduled(pool: any, userId: string, estimateIds: string[]) {
  try {
    const tok = await getGoogleToken(userId, pool);
    if (!tok) return { synced: 0 };
    const ph = estimateIds.map((_, i) => `$${i + 1}`).join(",");
    const ests = (await pool.query(
      `SELECT * FROM estimates WHERE id IN (${ph}) AND user_id = $${estimateIds.length + 1}`,
      [...estimateIds, userId]
    )).rows;
    let synced = 0;
    for (const est of ests) {
      const win = estimateEventWindow(est);
      const summary = `${est.project_name} — ${est.customer_name || ""}`.trim();
      const created = await createGoogleEvent(pool, userId, { summary, description: `BuildBid job: ${est.project_name} (${est.trade || "general"})`, start: win.start, end: win.end });
      await pool.query(
        "INSERT INTO calendar_events (id, user_id, estimate_id, google_event_id, summary, event_start, event_end) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [crypto.randomUUID(), userId, est.id, created.id, summary, win.start, win.end]
      );
      synced++;
    }
    return { synced };
  } catch (e: any) {
    console.error("[google-calendar] autoSyncScheduled failed:", e?.message || e);
    return { synced: 0, error: e.message };
  }
}
