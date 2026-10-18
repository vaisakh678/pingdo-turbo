import { Hono } from "hono";

import { serverInfo } from "../lib/server-info";

const healthRoute = new Hono();

healthRoute.get("/", (c) =>
  c.json({ data: { status: "ok", uptime: process.uptime(), ...serverInfo }, error: null }),
);

export default healthRoute;
