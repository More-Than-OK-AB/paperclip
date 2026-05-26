import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const companyFreezes = pgTable(
  "company_freezes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    declaredAt: timestamp("declared_at", { withTimezone: true }).notNull().defaultNow(),
    declaredByAgentId: uuid("declared_by_agent_id").references(() => agents.id),
    declaredByUserId: text("declared_by_user_id"),
    reason: text("reason").notNull(),
    scope: text("scope").notNull().default("roles"),
    scopedRoles: jsonb("scoped_roles").$type<string[]>(),
    scopedAgentIds: jsonb("scoped_agent_ids").$type<string[]>(),
    exemptRoles: jsonb("exempt_roles").$type<string[]>(),
    autoLiftConditions: jsonb("auto_lift_conditions").$type<Record<string, unknown>>(),
    scheduledLiftAt: timestamp("scheduled_lift_at", { withTimezone: true }),
    liftedAt: timestamp("lifted_at", { withTimezone: true }),
    liftedByAgentId: uuid("lifted_by_agent_id").references(() => agents.id),
    liftedByUserId: text("lifted_by_user_id"),
    liftReason: text("lift_reason"),
  },
  (table) => ({
    companyActiveFreezeIdx: index("company_freezes_company_active_idx")
      .on(table.companyId)
      .where(sql`${table.liftedAt} IS NULL`),
    companyDeclaredAtIdx: index("company_freezes_company_declared_at_idx").on(
      table.companyId,
      table.declaredAt,
    ),
  }),
);
