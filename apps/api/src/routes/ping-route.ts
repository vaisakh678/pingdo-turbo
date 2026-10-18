import type { APIResponse, ServerInfoDTO } from "@repo/dto";
import { pool } from "@repo/db";
import { Hono } from "hono";

import { serverInfo } from "../lib/server-info";
import { timedDb, type TimingEnv } from "../lib/timing";

// Two baselines for the latency page: `/ping` never touches the database
// (pure network + app), `/ping/db` adds a single `SELECT 1` round trip to
// Postgres (network + app + app↔db).
const pingRoute = new Hono<TimingEnv>()
  .get("/", (c) => c.json<APIResponse<ServerInfoDTO>>({ data: serverInfo }))
  .get("/db", async (c) => {
    await timedDb(c, () => pool.query("SELECT 1"));
    return c.json<APIResponse<ServerInfoDTO>>({ data: serverInfo });
  });

export default pingRoute;
