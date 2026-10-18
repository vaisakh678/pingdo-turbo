import { boolean, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const todoSchema = pgTable("todos", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 256 }).notNull(),
  completed: boolean("completed").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type TodoRow = typeof todoSchema.$inferSelect;
export type NewTodoRow = typeof todoSchema.$inferInsert;
