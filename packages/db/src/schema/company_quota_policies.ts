import { pgTable, uuid, text, real, boolean, timestamp, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const companyQuotaPolicies = pgTable(
  "company_quota_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    weeklyCapPercent: real("weekly_cap_percent").notNull().default(100),
    freezeExemptRoles: jsonb("freeze_exempt_roles")
      .$type<string[]>()
      .notNull()
      .default(["ceo", "mtoka", "platform-engineer"]),
    mtokaAutoFreezeEnabled: boolean("mtoka_auto_freeze_enabled").notNull().default(false),
    mtokaAutoFreezeSoftThresholdActualPct: real("mtoka_auto_freeze_soft_threshold_actual_pct"),
    mtokaAutoFreezeSoftThresholdProjectedEowPct: real("mtoka_auto_freeze_soft_threshold_projected_eow_pct"),
    mtokaAutoFreezeHardThresholdActualPct: real("mtoka_auto_freeze_hard_threshold_actual_pct"),
    mtokaAutoFreezeScopedRoles: jsonb("mtoka_auto_freeze_scoped_roles").$type<string[]>(),
    autoLiftAtActualPct: real("auto_lift_at_actual_pct"),
    autoLiftAtProjectedEowPct: real("auto_lift_at_projected_eow_pct"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedByAgentId: uuid("updated_by_agent_id").references(() => agents.id),
    updatedByUserId: text("updated_by_user_id"),
  },
  (table) => ({
    companyUniqueIdx: uniqueIndex("company_quota_policies_company_unique_idx").on(table.companyId),
  }),
);
