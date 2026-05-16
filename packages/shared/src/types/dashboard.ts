export interface DashboardRunActivityDay {
  date: string;
  succeeded: number;
  failed: number;
  other: number;
  total: number;
}

export interface DashboardRunBreakdownByIssue {
  issueId: string;
  identifier: string;
  runs: number;
}

export interface DashboardRunBreakdownByWakeReason {
  reason: string;
  runs: number;
}

export interface DashboardRunBreakdownByAgent {
  agentId: string;
  name: string;
  runs: number;
}

export interface DashboardRunBreakdown {
  date: string;
  byIssue: DashboardRunBreakdownByIssue[];
  byWakeReason: DashboardRunBreakdownByWakeReason[];
  byAgent: DashboardRunBreakdownByAgent[];
}

export interface DashboardSummary {
  companyId: string;
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
  budgets: {
    activeIncidents: number;
    pendingApprovals: number;
    pausedAgents: number;
    pausedProjects: number;
  };
  runActivity: DashboardRunActivityDay[];
  runBreakdown?: DashboardRunBreakdown;
}
