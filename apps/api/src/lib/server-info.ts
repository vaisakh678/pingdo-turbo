import type { ServerInfoDTO } from "@repo/dto";

import { env } from "../config/env";

// Each host exposes its region under a different env var. An explicit
// PLATFORM / REGION always wins so platforms we don't detect can still be
// labelled.
function detect(): ServerInfoDTO {
  const e = process.env;
  if (e.RAILWAY_ENVIRONMENT_NAME) {
    return { platform: "railway", region: e.RAILWAY_REPLICA_REGION ?? "unknown" };
  }
  if (e.FLY_REGION) return { platform: "fly", region: e.FLY_REGION };
  if (e.RENDER) return { platform: "render", region: e.RENDER_REGION ?? "unknown" };
  if (e.VERCEL_REGION) return { platform: "vercel", region: e.VERCEL_REGION };
  if (e.K_SERVICE) return { platform: "cloud-run", region: e.GOOGLE_CLOUD_REGION ?? "unknown" };
  if (e.AWS_REGION) return { platform: "aws", region: e.AWS_REGION };
  return { platform: "local", region: "local" };
}

const detected = detect();

export const serverInfo: ServerInfoDTO = {
  platform: env.PLATFORM || detected.platform,
  region: env.REGION || detected.region,
};
