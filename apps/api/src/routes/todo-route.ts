import type { APIResponse, TodoDTO } from "@repo/dto";
import { Hono } from "hono";
import { z } from "zod";

import { timedDb, type TimingEnv } from "../lib/timing";
import { validate } from "../lib/validator";
import {
  createTodo,
  deleteTodo,
  getTodo,
  listTodos,
  updateTodo,
} from "../services/todo-service";

const createSchema = z.object({ title: z.string().trim().min(1).max(256) });
const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(256).optional(),
    completed: z.boolean().optional(),
  })
  .refine((v) => v.title !== undefined || v.completed !== undefined, {
    message: "Nothing to update",
  });
const idSchema = z.object({ id: z.string().uuid() });

const todoRoute = new Hono<TimingEnv>()
  .get("/", async (c) => {
    const todos = await timedDb(c, () => listTodos());
    return c.json<APIResponse<TodoDTO[]>>({ data: todos });
  })
  .get("/:id", validate("param", idSchema), async (c) => {
    const { id } = c.req.valid("param");
    const todo = await timedDb(c, () => getTodo(id));
    return c.json<APIResponse<TodoDTO>>({ data: todo });
  })
  .post("/", validate("json", createSchema), async (c) => {
    const body = c.req.valid("json");
    const todo = await timedDb(c, () => createTodo(body));
    return c.json<APIResponse<TodoDTO>>({ data: todo }, 201);
  })
  .patch(
    "/:id",
    validate("param", idSchema),
    validate("json", updateSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const todo = await timedDb(c, () => updateTodo(id, body));
      return c.json<APIResponse<TodoDTO>>({ data: todo });
    },
  )
  .delete("/:id", validate("param", idSchema), async (c) => {
    const { id } = c.req.valid("param");
    await timedDb(c, () => deleteTodo(id));
    return c.json<APIResponse<{ deleted: boolean }>>({ data: { deleted: true } });
  });

export default todoRoute;
