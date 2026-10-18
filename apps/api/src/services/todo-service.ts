import db, { todoSchema, type TodoRow } from "@repo/db";
import type { CreateTodoDTO, TodoDTO, UpdateTodoDTO } from "@repo/dto";
import { desc, eq } from "drizzle-orm";

import { NotFound } from "../lib/api-error";

// Keeps list responses a fixed, small size so latency runs compare like
// with like no matter how many todos the benchmark has created.
const LIST_LIMIT = 50;

function toDTO(row: TodoRow): TodoDTO {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTodos(): Promise<TodoDTO[]> {
  const rows = await db
    .select()
    .from(todoSchema)
    .orderBy(desc(todoSchema.createdAt))
    .limit(LIST_LIMIT);
  return rows.map(toDTO);
}

export async function getTodo(id: string): Promise<TodoDTO> {
  const [row] = await db.select().from(todoSchema).where(eq(todoSchema.id, id)).limit(1);
  if (!row) throw NotFound("Todo not found");
  return toDTO(row);
}

export async function createTodo(input: CreateTodoDTO): Promise<TodoDTO> {
  const [row] = await db.insert(todoSchema).values({ title: input.title }).returning();
  return toDTO(row!);
}

export async function updateTodo(id: string, input: UpdateTodoDTO): Promise<TodoDTO> {
  const [row] = await db
    .update(todoSchema)
    .set(input)
    .where(eq(todoSchema.id, id))
    .returning();
  if (!row) throw NotFound("Todo not found");
  return toDTO(row);
}

export async function deleteTodo(id: string): Promise<void> {
  const [row] = await db
    .delete(todoSchema)
    .where(eq(todoSchema.id, id))
    .returning({ id: todoSchema.id });
  if (!row) throw NotFound("Todo not found");
}
