import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, companies, createDb, heartbeatRuns, issues } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { dashboardService, getUtcMonthStart } from "../services/dashboard.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres dashboard service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

function utcDay(offsetDays: number): Date {
  const now = new Date();
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays, 12);
  return new Date(day);
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe("getUtcMonthStart", () => {
  it("anchors the monthly spend window to UTC month boundaries", () => {
    expect(getUtcMonthStart(new Date("2026-03-31T20:30:00.000-05:00")).toISOString()).toBe(
      "2026-04-01T00:00:00.000Z",
    );
    expect(getUtcMonthStart(new Date("2026-04-01T00:30:00.000+14:00")).toISOString()).toBe(
      "2026-03-01T00:00:00.000Z",
    );
  });
});

describeEmbeddedPostgres("dashboard service", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-dashboard-service-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(heartbeatRuns);
    await db.delete(issues);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("aggregates the full 14-day run activity window without recent-run truncation", async () => {
    const companyId = randomUUID();
    const otherCompanyId = randomUUID();
    const agentId = randomUUID();
    const otherAgentId = randomUUID();
    const today = utcDay(0);
    const weekAgo = utcDay(-7);

    await db.insert(companies).values([
      {
        id: companyId,
        name: "Paperclip",
        issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
        requireBoardApprovalForNewAgents: false,
      },
      {
        id: otherCompanyId,
        name: "Other",
        issuePrefix: `T${otherCompanyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
        requireBoardApprovalForNewAgents: false,
      },
    ]);

    await db.insert(agents).values([
      {
        id: agentId,
        companyId,
        name: "CodexCoder",
        role: "engineer",
        status: "running",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: otherAgentId,
        companyId: otherCompanyId,
        name: "OtherAgent",
        role: "engineer",
        status: "running",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
    ]);

    await db.insert(heartbeatRuns).values([
      ...Array.from({ length: 105 }, () => ({
        id: randomUUID(),
        companyId,
        agentId,
        invocationSource: "assignment",
        status: "succeeded",
        createdAt: today,
      })),
      {
        id: randomUUID(),
        companyId,
        agentId,
        invocationSource: "assignment",
        status: "failed",
        createdAt: weekAgo,
      },
      {
        id: randomUUID(),
        companyId,
        agentId,
        invocationSource: "assignment",
        status: "timed_out",
        createdAt: weekAgo,
      },
      {
        id: randomUUID(),
        companyId,
        agentId,
        invocationSource: "assignment",
        status: "cancelled",
        createdAt: weekAgo,
      },
      {
        id: randomUUID(),
        companyId: otherCompanyId,
        agentId: otherAgentId,
        invocationSource: "assignment",
        status: "succeeded",
        createdAt: weekAgo,
      },
    ]);

    const summary = await dashboardService(db).summary(companyId);

    expect(summary.runActivity).toHaveLength(14);
    const todayBucket = summary.runActivity.find((bucket) => bucket.date === utcDateKey(today));
    const weekAgoBucket = summary.runActivity.find((bucket) => bucket.date === utcDateKey(weekAgo));

    expect(todayBucket).toMatchObject({
      succeeded: 105,
      failed: 0,
      other: 0,
      total: 105,
    });
    expect(weekAgoBucket).toMatchObject({
      succeeded: 0,
      failed: 2,
      other: 1,
      total: 3,
    });
  });

  it("returns runBreakdown grouped by issue, wakeReason, and agent for a given date", async () => {
    const companyId = randomUUID();
    const agentAId = randomUUID();
    const agentBId = randomUUID();
    const issueAId = randomUUID();
    const issueBId = randomUUID();
    const targetDate = utcDay(-1);
    const targetDateKey = utcDateKey(targetDate);
    const otherDate = utcDay(-3);

    await db.insert(companies).values({
      id: companyId,
      name: "TestCo",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values([
      {
        id: agentAId,
        companyId,
        name: "AgentA",
        role: "engineer",
        status: "idle",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: agentBId,
        companyId,
        name: "AgentB",
        role: "manager",
        status: "idle",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
    ]);

    await db.insert(issues).values([
      { id: issueAId, companyId, title: "Issue A", identifier: "T-1" },
      { id: issueBId, companyId, title: "Issue B", identifier: "T-2" },
    ]);

    await db.insert(heartbeatRuns).values([
      // AgentA on target date: 3 runs on issue A with reason issue_assigned
      ...Array.from({ length: 3 }, () => ({
        id: randomUUID(),
        companyId,
        agentId: agentAId,
        invocationSource: "assignment",
        status: "succeeded",
        createdAt: targetDate,
        contextSnapshot: { issueId: issueAId, wakeReason: "issue_assigned" },
      })),
      // AgentB on target date: 2 runs on issue B with reason issue_commented
      ...Array.from({ length: 2 }, () => ({
        id: randomUUID(),
        companyId,
        agentId: agentBId,
        invocationSource: "assignment",
        status: "succeeded",
        createdAt: targetDate,
        contextSnapshot: { issueId: issueBId, wakeReason: "issue_commented" },
      })),
      // AgentA on target date: 1 run on issue B with reason issue_commented
      {
        id: randomUUID(),
        companyId,
        agentId: agentAId,
        invocationSource: "on_demand",
        status: "succeeded",
        createdAt: targetDate,
        contextSnapshot: { issueId: issueBId, wakeReason: "issue_commented" },
      },
      // Run on a different date — must not appear in breakdown
      {
        id: randomUUID(),
        companyId,
        agentId: agentAId,
        invocationSource: "assignment",
        status: "succeeded",
        createdAt: otherDate,
        contextSnapshot: { issueId: issueAId, wakeReason: "issue_assigned" },
      },
    ]);

    const summary = await dashboardService(db).summary(companyId, { date: targetDateKey });

    expect(summary.runBreakdown).toBeDefined();
    const breakdown = summary.runBreakdown!;
    expect(breakdown.date).toBe(targetDateKey);

    // byIssue: issue A has 3 runs, issue B has 3 runs (2+1)
    const issueA = breakdown.byIssue.find((r) => r.issueId === issueAId);
    const issueB = breakdown.byIssue.find((r) => r.issueId === issueBId);
    expect(issueA).toMatchObject({ identifier: "T-1", runs: 3 });
    expect(issueB).toMatchObject({ identifier: "T-2", runs: 3 });

    // byWakeReason: issue_assigned has 3, issue_commented has 3
    const assigned = breakdown.byWakeReason.find((r) => r.reason === "issue_assigned");
    const commented = breakdown.byWakeReason.find((r) => r.reason === "issue_commented");
    expect(assigned).toMatchObject({ runs: 3 });
    expect(commented).toMatchObject({ runs: 3 });

    // byAgent: AgentA has 4 runs (3+1), AgentB has 2
    const agentA = breakdown.byAgent.find((r) => r.agentId === agentAId);
    const agentB = breakdown.byAgent.find((r) => r.agentId === agentBId);
    expect(agentA).toMatchObject({ name: "AgentA", runs: 4 });
    expect(agentB).toMatchObject({ name: "AgentB", runs: 2 });
  });

  it("omits runBreakdown from the response when no date is provided", async () => {
    const companyId = randomUUID();
    const agentId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "TestCo2",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "Agent",
      role: "engineer",
      status: "idle",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    const summary = await dashboardService(db).summary(companyId);
    expect(summary.runBreakdown).toBeUndefined();
  });
});
