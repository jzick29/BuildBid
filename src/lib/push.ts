import { makeAuthFn } from "./iso";
import { getPool } from "./pool";

export const saveSubscription = makeAuthFn("push.saveSubscription", async (args: { data: { endpoint: string; p256dhKey: string; authKey: string } }, userId, pool) => {
  const existR = await pool.query("SELECT id FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2", [args.data.endpoint, userId]);
  if (existR.rows[0]) {
    await pool.query("UPDATE push_subscriptions SET p256dh_key = $1, auth_key = $2, updated_at = NOW() WHERE id = $3", [args.data.p256dhKey, args.data.authKey, existR.rows[0].id]);
    return { id: existR.rows[0].id };
  }
  const id = crypto.randomUUID();
  await pool.query("INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh_key, auth_key) VALUES ($1,$2,$3,$4,$5)", [id, userId, args.data.endpoint, args.data.p256dhKey, args.data.authKey]);
  return { id };
});

export const removeSubscription = makeAuthFn("push.removeSubscription", async (args: { data: { endpoint: string } }, userId, pool) => {
  await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2", [args.data.endpoint, userId]);
  return { success: true };
});

export const getSubscriptions = makeAuthFn("push.getSubscriptions", async (_args, userId, pool) => {
  return (await pool.query("SELECT * FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC", [userId])).rows;
});

import { registerHandler } from "./call-registry";
import { createIsomorphicFn } from "@tanstack/react-start";
const _getVapidKey = async () => ({ publicKey: process.env.VAPID_PUBLIC_KEY || "BHrL8vZC7MqK0vX4N9pW2yF3jR6tS1aD5cE8gH0kJ3mY7bU4wX9zA2nP6qV1lO5s" });
registerHandler("push.getVapidPublicKey", _getVapidKey);
export const getVapidPublicKey = createIsomorphicFn()
  .client(async () => { const res = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: "push.getVapidPublicKey", args: {} }), credentials: "include" }); if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); } return res.json(); })
  .server(_getVapidKey);

// Standalone push notification sender (used by other modules)
export async function sendPushNotification(userId: string, title: string, body: string, url?: string) {
  const pool = getPool();
  const subs = (await pool.query("SELECT * FROM push_subscriptions WHERE user_id = $1", [userId])).rows;
  if (!subs.length) return;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "placeholder-private";
  const vapidSubject = "mailto:notifications@buildbid.app";
  for (const sub of subs) {
    try {
      const payload = JSON.stringify({ title, body, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: url || "/dashboard" } });
      await sendWebPush(sub.endpoint, sub.p256dh_key, sub.auth_key, payload, vapidSubject, vapidPrivateKey);
    } catch (e) {
      if ((e as any)?.status === 410 || (e as any)?.status === 404) {
        await pool.query("DELETE FROM push_subscriptions WHERE id = $1", [sub.id]);
      }
    }
  }
}

async function sendWebPush(endpoint: string, p256dh: string, auth: string, payload: string, subject: string, vapidPrivateKey: string) {
  const vapidHeader = await generateVapidHeader(endpoint, subject, vapidPrivateKey);
  const resp = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/octet-stream", "TTL": "86400", "Urgency": "normal", "Authorization": vapidHeader, "Content-Encoding": "aes128gcm" }, body: payload });
  if (!resp.ok && resp.status !== 201) { const err: any = new Error(`Push failed: ${resp.status}`); err.status = resp.status; throw err; }
}

async function generateVapidHeader(endpoint: string, subject: string, privateKey: string): Promise<string> {
  const url = new URL(endpoint);
  const header = { typ: "JWT", alg: "ES256" };
  const claims = { aud: url.origin, exp: Math.floor(Date.now() / 1000) + 86400, sub: subject };
  const b64Header = btoaUrl(JSON.stringify(header));
  const b64Claims = btoaUrl(JSON.stringify(claims));
  return `vapid t=${b64Header}.${b64Claims}, k=${process.env.VAPID_PUBLIC_KEY || "BHrL8vZC7MqK0vX4N9pW2yF3jR6tS1aD5cE8gH0kJ3mY7bU4wX9zA2nP6qV1lO5s"}`;
}

function btoaUrl(str: string): string { return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
