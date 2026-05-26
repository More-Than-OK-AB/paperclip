import { pgTable, uuid, real, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const companyUsageReports = pgTable(
  "company_usage_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
    reportedByAgentId: uuid("reported_by_agent_id")
      .notNull()
      .references(() => agents.id),
    sonnetWeeklyActualPct: real("sonnet_weekly_actual_pct").notNull(),
    sonnetProjectedEowPct: real("sonnet_projected_eow_pct"),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>(),
  },
  (table) => ({
    companyReportedAtIdx: index("company_usage_reports_company_reported_at_idx").on(
      table.companyId,
      table.reportedAt,
    ),
  }),
);
