/** Typesafe API client for BuildBid backend calls */

const BASE = ""; // same-origin in TanStack Start

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  app: string;
}

export const api = {
  health: () => request<HealthResponse>("/api/health"),
};
