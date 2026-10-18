import type { APIResponse, ServerInfoDTO } from "@repo/dto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { APIError } from "./lib/api-error";
import { logger } from "./lib/logger";
import { serverInfo } from "./lib/server-info";
import { serverTiming, type TimingEnv } from "./lib/timing";
import appRoutes from "./routes";

export function createApp() {
  const app = new Hono<TimingEnv>();
  app.use(honoLogger());
  app.use(
    "*",
    cors({
      origin: "*",
      // The latency page reads these off cross-origin responses.
      exposeHeaders: ["Server-Timing", "X-Pingdo-Platform", "X-Pingdo-Region"],
      // Cache preflights so the browser only pays for them once per endpoint.
      maxAge: 86400,
    }),
  );
  app.use("*", async (c, next) => {
    await next();
    c.header("Timing-Allow-Origin", "*");
  });
  app.use("*", serverTiming);

  app.onError((err, c) => {
    if (err instanceof APIError) {
      return c.json<APIResponse<null>>(
        { data: null, error: err.message },
        err.statusCode as ContentfulStatusCode,
      );
    }
    logger.error({ err, method: c.req.method, path: c.req.path }, "Unhandled error");
    return c.json<APIResponse<null>>({ data: null, error: "Internal server error" }, 500);
  });

  app.get("/", (c) =>
    c.json<APIResponse<{ name: string } & ServerInfoDTO>>({
      data: { name: "Pingdo API", ...serverInfo },
    }),
  );

  app.route("/api/v1", appRoutes);

  return app;
}
