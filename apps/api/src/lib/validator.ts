import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodSchema } from "zod";

import { BadRequest } from "./api-error";

/** `zValidator` that fails with our `{ data, error }` envelope instead of
 *  zod's raw issue list. */
export const validate = <T extends ZodSchema, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  zValidator(target, schema, (result) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue?.path.join(".");
      throw BadRequest(field ? `${field}: ${issue?.message}` : (issue?.message ?? "Invalid request"));
    }
  });
