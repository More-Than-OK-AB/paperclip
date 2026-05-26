import { z } from "zod";

export const FREEZE_SCOPES = ["all", "roles", "agents"] as const;
export const FREEZE_EVENT_TYPES = ["declared", "scope_updated", "no_op", "lifted"] as const;

export const declareFreezeSchema = z.object({
  reason: z.string().min(1),
  scope: z.enum(FREEZE_SCOPES).optional().default("roles"),
  scopedRoles: z.array(z.string()).optional(),
  scopedAgentIds: z.array(z.string().uuid()).optional(),
  exemptRoles: z.array(z.string()).optional(),
  autoLiftConditions: z.record(z.unknown()).optional(),
  scheduledLiftAt: z.string().datetime().optional(),
});

export type DeclareFreeze = z.infer<typeof declareFreezeSchema>;

export const liftFreezeSchema = z.object({
  reason: z.string().min(1),
});

export type LiftFreeze = z.infer<typeof liftFreezeSchema>;

export const putQuotaPolicySchema = z.object({
  weeklyCapPercent: z.number().nonnegative().optional(),
  freezeExemptRoles: z.array(z.string()).optional(),
  mtokaAutoFreezeEnabled: z.boolean().optional(),
  mtokaAutoFreezeSoftThresholdActualPct: z.number().nonnegative().optional().nullable(),
  mtokaAutoFreezeSoftThresholdProjectedEowPct: z.number().nonnegative().optional().nullable(),
  mtokaAutoFreezeHardThresholdActualPct: z.number().nonnegative().optional().nullable(),
  mtokaAutoFreezeScopedRoles: z.array(z.string()).optional().nullable(),
  autoLiftAtActualPct: z.number().nonnegative().optional().nullable(),
  autoLiftAtProjectedEowPct: z.number().nonnegative().optional().nullable(),
});

export type PutQuotaPolicy = z.infer<typeof putQuotaPolicySchema>;

export const postUsageReportSchema = z.object({
  sonnetWeeklyActualPct: z.number().nonnegative(),
  sonnetProjectedEowPct: z.number().nonnegative().optional(),
  rawData: z.record(z.unknown()).optional(),
});

export type PostUsageReport = z.infer<typeof postUsageReportSchema>;
