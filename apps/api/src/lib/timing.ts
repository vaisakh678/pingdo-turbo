import type { Context, MiddlewareHandler } from "hono";

import { serverInfo } from "./server-info";

export type TimingEnv = { Variables: { dbMs: number } };

/** Runs a DB call and adds its duration to the request's `db` timing. */
export async function timedDb<T>(c: Context<TimingEnv>, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    c.set("dbMs", (c.get("dbMs") ?? 0) + (performance.now() - start));
  }
}

/** Adds `Server-Timing` (db + total server time) and the serving
 *  platform/region headers, so a client can split its round-trip time into
 *  network vs. app vs. database. */
export const serverTiming: MiddlewareHandler<TimingEnv> = async (c, next) => {
  const start = performance.now();
  c.set("dbMs", 0);
  await next();
  const total = performance.now() - start;
  c.header(
    "Server-Timing",
    `db;dur=${c.get("dbMs").toFixed(2)}, app;dur=${total.toFixed(2)}`,
  );
  c.header("X-Pingdo-Platform", serverInfo.platform);
  c.header("X-Pingdo-Region", serverInfo.region);
};
