// Call registry — maps "module.fnName" → async server handler.
// Each lib module registers its server-side implementations here.
// The generic /api/call handler in vercel-entry.ts uses this to dispatch.

type HandlerFn = (args: any, sessionToken?: string) => Promise<any>;

const registry = new Map<string, HandlerFn>();

export function registerHandler(name: string, fn: HandlerFn) {
  registry.set(name, fn);
}

export function getHandler(name: string): HandlerFn | undefined {
  return registry.get(name);
}

export function registeredNames(): string[] {
  return Array.from(registry.keys());
}
