import { relations } from "drizzle-orm";
import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "@auth/core/adapters";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  timezone: text("timezone").notNull().default("America/Costa_Rica"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ],
);

export const items = pgTable("item", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<"task" | "assignment" | "exam" | "event">().notNull(),
  title: text("title").notNull(),
  notes: text("notes"),
  dueAt: timestamp("dueAt", { mode: "date" }),
  startAt: timestamp("startAt", { mode: "date" }),
  endAt: timestamp("endAt", { mode: "date" }),
  durationMinutes: integer("durationMinutes"),
  priority: text("priority").$type<"low" | "medium" | "high">().notNull().default("medium"),
  status: text("status").$type<"pending" | "done" | "cancelled">().notNull().default("pending"),
  calendarEventId: text("calendarEventId"),
  source: text("source").$type<"voice" | "text">().notNull().default("text"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().$defaultFn(() => new Date()),
});

export const classBlocks = pgTable("class_block", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dayOfWeek: integer("dayOfWeek").notNull(),
  startTime: text("startTime").notNull(),
  endTime: text("endTime").notNull(),
  location: text("location"),
  calendarEventId: text("calendarEventId"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().$defaultFn(() => new Date()),
});

export const commandLogs = pgTable("command_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  transcript: text("transcript").notNull(),
  source: text("source").$type<"voice" | "text">().notNull(),
  result: text("result"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().$defaultFn(() => new Date()),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  items: many(items),
  classBlocks: many(classBlocks),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  user: one(users, { fields: [items.userId], references: [users.id] }),
}));

export const classBlocksRelations = relations(classBlocks, ({ one }) => ({
  user: one(users, { fields: [classBlocks.userId], references: [users.id] }),
}));

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type ClassBlock = typeof classBlocks.$inferSelect;
export type NewClassBlock = typeof classBlocks.$inferInsert;
