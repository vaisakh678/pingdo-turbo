import { Hono } from "hono";

import type { TimingEnv } from "../lib/timing";
import healthRoute from "./health-route";
import pingRoute from "./ping-route";
import todoRoute from "./todo-route";

const appRoutes = new Hono<TimingEnv>();

appRoutes.route("/health", healthRoute);
appRoutes.route("/ping", pingRoute);
appRoutes.route("/todos", todoRoute);

export default appRoutes;
