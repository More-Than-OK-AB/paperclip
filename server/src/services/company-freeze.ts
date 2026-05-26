import { and, eq, isNull, desc, asc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  companyFreezes,
  companyFreezeEvents,
  companyQuotaPolicies,
  companyUsageReports,
  agents,
} from "@paperclipai/db";
import { notFound } from "../errors.js";
import type { DeclareFreeze, LiftFreeze, PutQuotaPolicy, PostUsageReport } from "@paperclipai/shared";

export function companyFreezeService(db: Db) {
  async function getActiveFreeze(companyId: string) {
    return db
      .select()
      .from(companyFreezes)
      .where(and(eq(companyFreezes.companyId, companyId), isNull(companyFreezes.liftedAt)))
      .then((rows) => rows[0] ?? null);
  }

  async function declareOrUpdateFreeze(
    companyId: string,
    input: DeclareFreeze,
    actor: { agentId: string | null; userId: string | null },
  ) {
    const existing = await getActiveFreeze(companyId);

    if (!existing) {
      const [freeze] = await db
        .insert(companyFreezes)
        .values({
          companyId,
          reason: input.reason,
          scope: input.scope ?? "roles",
          scopedRoles: input.scopedRoles ?? null,
          scopedAgentIds: input.scopedAgentIds ?? null,
          exemptRoles: input.exemptRoles ?? null,
          autoLiftConditions: input.autoLiftConditions ?? null,
          scheduledLiftAt: input.scheduledLiftAt ? new Date(input.scheduledLiftAt) : null,
          declaredByAgentId: actor.agentId,
          declaredByUserId: actor.userId,
        })
        .returning();

      await db.insert(companyFreezeEvents).values({
        freezeId: freeze.id,
        eventType: "declared",
        changedByAgentId: actor.agentId,
        changedByUserId: actor.userId,
        newScopedRoles: input.scopedRoles ?? null,
        reason: input.reason,
      });

      return { freeze, created: true };
    }

    const previousScopedRoles = existing.scopedRoles;
    const newScopedRoles = input.scopedRoles ?? existing.scopedRoles;
    const rolesChanged = JSON.stringify(previousScopedRoles) !== JSON.stringify(newScopedRoles);
    const eventType = rolesChanged ? "scope_updated" : "no_op";

    const [updated] = await db
      .update(companyFreezes)
      .set({
        reason: input.reason,
        scope: input.scope ?? existing.scope,
        scopedRoles: input.scopedRoles ?? existing.scopedRoles,
        scopedAgentIds: input.scopedAgentIds ?? existing.scopedAgentIds,
        exemptRoles: input.exemptRoles ?? existing.exemptRoles,
        autoLiftConditions: input.autoLiftConditions ?? existing.autoLiftConditions,
        scheduledLiftAt: input.scheduledLiftAt ? new Date(input.scheduledLiftAt) : existing.scheduledLiftAt,
      })
      .where(eq(companyFreezes.id, existing.id))
      .returning();

    await db.insert(companyFreezeEvents).values({
      freezeId: existing.id,
      eventType,
      changedByAgentId: actor.agentId,
      changedByUserId: actor.userId,
      previousScopedRoles,
      newScopedRoles,
      reason: input.reason,
    });

    return { freeze: updated, created: false };
  }

  async function liftFreeze(
    companyId: string,
    input: LiftFreeze,
    actor: { agentId: string | null; userId: string | null },
  ) {
    const existing = await getActiveFreeze(companyId);
    if (!existing) throw notFound("No active freeze found for this company");

    const [lifted] = await db
      .update(companyFreezes)
      .set({
        liftedAt: new Date(),
        liftedByAgentId: actor.agentId,
        liftedByUserId: actor.userId,
        liftReason: input.reason,
      })
      .where(eq(companyFreezes.id, existing.id))
      .returning();

    await db.insert(companyFreezeEvents).values({
      freezeId: existing.id,
      eventType: "lifted",
      changedByAgentId: actor.agentId,
      changedByUserId: actor.userId,
      reason: input.reason,
    });

    return lifted;
  }

  async function listFreezes(companyId: string, opts: { limit?: number; offset?: number } = {}) {
    const limit = opts.limit ?? 20;
    const offset = opts.offset ?? 0;
    return db
      .select()
      .from(companyFreezes)
      .where(eq(companyFreezes.companyId, companyId))
      .orderBy(desc(companyFreezes.declaredAt))
      .limit(limit)
      .offset(offset);
  }

  async function listFreezeEvents(companyId: string) {
    const active = await getActiveFreeze(companyId);
    if (!active) throw notFound("No active freeze found for this company");

    return db
      .select()
      .from(companyFreezeEvents)
      .where(eq(companyFreezeEvents.freezeId, active.id))
      .orderBy(asc(companyFreezeEvents.changedAt));
  }

  async function getQuotaPolicy(companyId: string) {
    return db
      .select()
      .from(companyQuotaPolicies)
      .where(eq(companyQuotaPolicies.companyId, companyId))
      .then((rows) => rows[0] ?? null);
  }

  async function upsertQuotaPolicy(
    companyId: string,
    input: PutQuotaPolicy,
    actor: { agentId: string | null; userId: string | null },
  ) {
    const existing = await getQuotaPolicy(companyId);

    if (!existing) {
      const [policy] = await db
        .insert(companyQuotaPolicies)
        .values({
          companyId,
          weeklyCapPercent: input.weeklyCapPercent ?? 100,
          freezeExemptRoles: input.freezeExemptRoles ?? ["ceo", "mtoka", "platform-engineer"],
          mtokaAutoFreezeEnabled: input.mtokaAutoFreezeEnabled ?? false,
          mtokaAutoFreezeSoftThresholdActualPct: input.mtokaAutoFreezeSoftThresholdActualPct ?? null,
          mtokaAutoFreezeSoftThresholdProjectedEowPct:
            input.mtokaAutoFreezeSoftThresholdProjectedEowPct ?? null,
          mtokaAutoFreezeHardThresholdActualPct: input.mtokaAutoFreezeHardThresholdActualPct ?? null,
          mtokaAutoFreezeScopedRoles: input.mtokaAutoFreezeScopedRoles ?? null,
          autoLiftAtActualPct: input.autoLiftAtActualPct ?? null,
          autoLiftAtProjectedEowPct: input.autoLiftAtProjectedEowPct ?? null,
          updatedByAgentId: actor.agentId,
          updatedByUserId: actor.userId,
          updatedAt: new Date(),
        })
        .returning();
      return policy;
    }

    const [updated] = await db
      .update(companyQuotaPolicies)
      .set({
        ...(input.weeklyCapPercent !== undefined ? { weeklyCapPercent: input.weeklyCapPercent } : {}),
        ...(input.freezeExemptRoles !== undefined ? { freezeExemptRoles: input.freezeExemptRoles } : {}),
        ...(input.mtokaAutoFreezeEnabled !== undefined
          ? { mtokaAutoFreezeEnabled: input.mtokaAutoFreezeEnabled }
          : {}),
        ...(input.mtokaAutoFreezeSoftThresholdActualPct !== undefined
          ? { mtokaAutoFreezeSoftThresholdActualPct: input.mtokaAutoFreezeSoftThresholdActualPct }
          : {}),
        ...(input.mtokaAutoFreezeSoftThresholdProjectedEowPct !== undefined
          ? {
              mtokaAutoFreezeSoftThresholdProjectedEowPct:
                input.mtokaAutoFreezeSoftThresholdProjectedEowPct,
            }
          : {}),
        ...(input.mtokaAutoFreezeHardThresholdActualPct !== undefined
          ? { mtokaAutoFreezeHardThresholdActualPct: input.mtokaAutoFreezeHardThresholdActualPct }
          : {}),
        ...(input.mtokaAutoFreezeScopedRoles !== undefined
          ? { mtokaAutoFreezeScopedRoles: input.mtokaAutoFreezeScopedRoles }
          : {}),
        ...(input.autoLiftAtActualPct !== undefined ? { autoLiftAtActualPct: input.autoLiftAtActualPct } : {}),
        ...(input.autoLiftAtProjectedEowPct !== undefined
          ? { autoLiftAtProjectedEowPct: input.autoLiftAtProjectedEowPct }
          : {}),
        updatedByAgentId: actor.agentId,
        updatedByUserId: actor.userId,
        updatedAt: new Date(),
      })
      .where(eq(companyQuotaPolicies.id, existing.id))
      .returning();
    return updated;
  }

  async function postUsageReport(
    companyId: string,
    input: PostUsageReport,
    reportedByAgentId: string,
  ) {
    const [report] = await db
      .insert(companyUsageReports)
      .values({
        companyId,
        reportedByAgentId,
        sonnetWeeklyActualPct: input.sonnetWeeklyActualPct,
        sonnetProjectedEowPct: input.sonnetProjectedEowPct ?? null,
        rawData: input.rawData ?? null,
        reportedAt: new Date(),
      })
      .returning();
    return report;
  }

  async function getLatestUsageReport(companyId: string) {
    return db
      .select()
      .from(companyUsageReports)
      .where(eq(companyUsageReports.companyId, companyId))
      .orderBy(desc(companyUsageReports.reportedAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);
  }

  async function isAgentFrozen(
    companyId: string,
    agentRole: string,
    agentId: string,
  ): Promise<{ frozen: true; freezeId: string } | { frozen: false }> {
    const freeze = await getActiveFreeze(companyId);
    if (!freeze) return { frozen: false };

    const exemptRoles = freeze.exemptRoles as string[] | null;
    if (exemptRoles && exemptRoles.includes(agentRole)) return { frozen: false };

    if (freeze.scope === "all") {
      return { frozen: true, freezeId: freeze.id };
    }

    if (freeze.scope === "roles") {
      const scopedRoles = freeze.scopedRoles as string[] | null;
      if (!scopedRoles || scopedRoles.includes(agentRole)) {
        return { frozen: true, freezeId: freeze.id };
      }
      return { frozen: false };
    }

    if (freeze.scope === "agents") {
      const scopedAgentIds = freeze.scopedAgentIds as string[] | null;
      if (scopedAgentIds && scopedAgentIds.includes(agentId)) {
        return { frozen: true, freezeId: freeze.id };
      }
      return { frozen: false };
    }

    return { frozen: false };
  }

  return {
    getActiveFreeze,
    declareOrUpdateFreeze,
    liftFreeze,
    listFreezes,
    listFreezeEvents,
    getQuotaPolicy,
    upsertQuotaPolicy,
    postUsageReport,
    getLatestUsageReport,
    isAgentFrozen,
  };
}
