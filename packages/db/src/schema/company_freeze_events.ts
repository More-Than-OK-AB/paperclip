import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companyFreezes } from "./company_freezes.js";
import { agents } from "./agents.js";

export const companyFreezeEvents = pgTable(
  "company_freeze_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    freezeId: uuid("freeze_id")
      .notNull()
      .references(() => companyFreezes.id),
    eventType: text("event_type").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
    changedByAgentId: uuid("changed_by_agent_id").references(() => agents.id),
    changedByUserId: text("changed_by_user_id"),
    previousScopedRoles: jsonb("previous_scoped_roles").$type<string[]>(),
    newScopedRoles: jsonb("new_scoped_roles").$type<string[]>(),
    reason: text("reason"),
  },
  (table) => ({
    freezeChangedAtIdx: index("company_freeze_events_freeze_changed_at_idx").on(
      table.freezeId,
      table.changedAt,
    ),
  }),
);
