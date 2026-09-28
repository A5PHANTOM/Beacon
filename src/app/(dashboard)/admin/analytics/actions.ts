"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export type ProjectMemberWorkload = {
  id: string;
  name: string;
  email: string;
  roleInProject: string;
  assignedIssuesCount: number;
  resolvedIssuesCount: number;
  raisedIssuesCount: number;
};

export type DeveloperPerformance = {
  id: string;
  name: string;
  email: string;
  assignedCount: number;
  resolvedCount: number;
  activeCount: number;
  resolutionRate: number;
  avgResolutionHours: number;
  avgResolutionFormatted: string;
  projects: {
    projectId: string;
    projectKey: string;
    projectName: string;
    assigned: number;
    resolved: number;
  }[];
};

export type TesterPerformance = {
  id: string;
  name: string;
  email: string;
  totalRaised: number;
  byProject: {
    projectId: string;
    projectKey: string;
    projectName: string;
    count: number;
  }[];
  bySeverity: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  byStatus: {
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  };
};

export type RecentIssueItem = {
  id: string;
  number: number;
  key: string;
  title: string;
  status: string;
  severity: string;
  priority: string;
  createdAt: string;
  reporterName: string;
  assigneeName: string | null;
};

export type ProjectAnalyticsData = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  createdAt: string;
  membersCount: number;
  totalIssues: number;
  openIssues: number;
  inProgressIssues: number;
  resolvedIssues: number;
  closedIssues: number;
  avgResolutionHours: number;
  avgResolutionFormatted: string;
  resolutionRatePercent: number;
  statusBreakdown: Record<string, number>;
  severityBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  developers: DeveloperPerformance[];
  testers: TesterPerformance[];
  members: ProjectMemberWorkload[];
  recentIssues: RecentIssueItem[];
};

export type SystemAnalyticsData = {
  overview: {
    totalUsers: number;
    adminCount: number;
    memberCount: number;
    totalProjects: number;
    activeProjects: number;
    totalIssues: number;
    openIssues: number;
    inProgressIssues: number;
    resolvedIssues: number;
    closedIssues: number;
    avgResolutionHours: number;
    avgResolutionFormatted: string;
    resolutionRatePercent: number;
  };
  statusDistribution: {
    status: string;
    label: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  severityDistribution: {
    severity: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  priorityDistribution: {
    priority: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  developers: DeveloperPerformance[];
  testers: TesterPerformance[];
  projects: ProjectAnalyticsData[];
};

function formatDuration(hours: number): string {
  if (hours <= 0 || isNaN(hours)) return "N/A";
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `${mins}m`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

export async function getSystemAnalyticsData(): Promise<SystemAnalyticsData> {
  const [users, rawProjects, customStatuses] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    }),
    prisma.project.findMany({
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        issues: {
          include: {
            reporter: { select: { id: true, name: true, email: true } },
            assignee: { select: { id: true, name: true, email: true } },
            history: {
              where: { fieldChanged: "status" },
              orderBy: { changedAt: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.customStatus.findMany(),
  ]);

  const customDoneKeys = new Set<string>();
  customStatuses.forEach((cs) => {
    if (cs.category === "DONE") {
      customDoneKeys.add(cs.key);
    }
  });

  const isResolvedOrClosed = (status: string) => {
    const s = status.toUpperCase();
    return s === "FIXED" || s === "VERIFIED" || s === "CLOSED" || customDoneKeys.has(status);
  };

  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const memberCount = totalUsers - adminCount;

  let allIssuesCount = 0;
  let allOpenIssues = 0;
  let allInProgressIssues = 0;
  let allResolvedIssues = 0;
  let allClosedIssues = 0;

  const systemStatusCounts: Record<string, number> = {};
  const systemSeverityCounts: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  const systemPriorityCounts: Record<string, number> = {
    URGENT: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  const allResolutionDurationsHours: number[] = [];
  const projectAnalyticsList: ProjectAnalyticsData[] = [];

  // System-level developer and tester tracking maps
  type DevStats = {
    user: { id: string; name: string; email: string };
    assigned: number;
    resolved: number;
    active: number;
    resolutionHours: number[];
    projectsMap: Record<string, { projectKey: string; projectName: string; assigned: number; resolved: number }>;
  };

  type TesterStats = {
    user: { id: string; name: string; email: string };
    totalRaised: number;
    byProject: Record<string, { projectKey: string; projectName: string; count: number }>;
    bySeverity: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number };
    byStatus: { open: number; inProgress: number; resolved: number; closed: number };
  };

  const systemDevMap = new Map<string, DevStats>();
  const systemTesterMap = new Map<string, TesterStats>();

  for (const proj of rawProjects) {
    const projIssues = proj.issues;
    const projTotalIssues = projIssues.length;
    allIssuesCount += projTotalIssues;

    let projOpen = 0;
    let projInProgress = 0;
    let projResolved = 0;
    let projClosed = 0;

    const projStatusCounts: Record<string, number> = {};
    const projSeverityCounts: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };
    const projPriorityCounts: Record<string, number> = {
      URGENT: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    const projResolutionDurationsHours: number[] = [];
    const memberAssignedCount: Record<string, number> = {};
    const memberResolvedCount: Record<string, number> = {};
    const memberRaisedCount: Record<string, number> = {};

    proj.members.forEach((m) => {
      memberAssignedCount[m.userId] = 0;
      memberResolvedCount[m.userId] = 0;
      memberRaisedCount[m.userId] = 0;
    });

    const projectDevMap = new Map<string, DevStats>();
    const projectTesterMap = new Map<string, TesterStats>();

    for (const issue of projIssues) {
      const st = issue.status;
      projStatusCounts[st] = (projStatusCounts[st] || 0) + 1;
      systemStatusCounts[st] = (systemStatusCounts[st] || 0) + 1;

      const sev = (issue.severity || "MEDIUM").toUpperCase() as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
      projSeverityCounts[sev] = (projSeverityCounts[sev] || 0) + 1;
      systemSeverityCounts[sev] = (systemSeverityCounts[sev] || 0) + 1;

      const prio = (issue.priority || "MEDIUM").toUpperCase();
      projPriorityCounts[prio] = (projPriorityCounts[prio] || 0) + 1;
      systemPriorityCounts[prio] = (systemPriorityCounts[prio] || 0) + 1;

      // Track Tester / Reporter Activity
      if (issue.reporter) {
        const reporterId = issue.reporter.id;
        memberRaisedCount[reporterId] = (memberRaisedCount[reporterId] || 0) + 1;

        // System tester aggregator
        if (!systemTesterMap.has(reporterId)) {
          systemTesterMap.set(reporterId, {
            user: issue.reporter,
            totalRaised: 0,
            byProject: {},
            bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
            byStatus: { open: 0, inProgress: 0, resolved: 0, closed: 0 },
          });
        }
        const sysTester = systemTesterMap.get(reporterId)!;
        sysTester.totalRaised++;
        if (!sysTester.byProject[proj.id]) {
          sysTester.byProject[proj.id] = { projectKey: proj.key, projectName: proj.name, count: 0 };
        }
        sysTester.byProject[proj.id].count++;
        sysTester.bySeverity[sev] = (sysTester.bySeverity[sev] || 0) + 1;

        // Project tester aggregator
        if (!projectTesterMap.has(reporterId)) {
          projectTesterMap.set(reporterId, {
            user: issue.reporter,
            totalRaised: 0,
            byProject: { [proj.id]: { projectKey: proj.key, projectName: proj.name, count: 0 } },
            bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
            byStatus: { open: 0, inProgress: 0, resolved: 0, closed: 0 },
          });
        }
        const pTester = projectTesterMap.get(reporterId)!;
        pTester.totalRaised++;
        pTester.byProject[proj.id].count++;
        pTester.bySeverity[sev] = (pTester.bySeverity[sev] || 0) + 1;

        const stUpper = st.toUpperCase();
        if (stUpper === "CLOSED") {
          sysTester.byStatus.closed++;
          pTester.byStatus.closed++;
        } else if (stUpper === "FIXED" || stUpper === "VERIFIED" || customDoneKeys.has(st)) {
          sysTester.byStatus.resolved++;
          pTester.byStatus.resolved++;
        } else if (stUpper === "IN_PROGRESS") {
          sysTester.byStatus.inProgress++;
          pTester.byStatus.inProgress++;
        } else {
          sysTester.byStatus.open++;
          pTester.byStatus.open++;
        }
      }

      // Track Developer / Assignee Activity
      if (issue.assignee) {
        const assigneeId = issue.assignee.id;
        memberAssignedCount[assigneeId] = (memberAssignedCount[assigneeId] || 0) + 1;

        // System dev aggregator
        if (!systemDevMap.has(assigneeId)) {
          systemDevMap.set(assigneeId, {
            user: issue.assignee,
            assigned: 0,
            resolved: 0,
            active: 0,
            resolutionHours: [],
            projectsMap: {},
          });
        }
        const sysDev = systemDevMap.get(assigneeId)!;
        sysDev.assigned++;
        if (!sysDev.projectsMap[proj.id]) {
          sysDev.projectsMap[proj.id] = { projectKey: proj.key, projectName: proj.name, assigned: 0, resolved: 0 };
        }
        sysDev.projectsMap[proj.id].assigned++;

        // Project dev aggregator
        if (!projectDevMap.has(assigneeId)) {
          projectDevMap.set(assigneeId, {
            user: issue.assignee,
            assigned: 0,
            resolved: 0,
            active: 0,
            resolutionHours: [],
            projectsMap: { [proj.id]: { projectKey: proj.key, projectName: proj.name, assigned: 0, resolved: 0 } },
          });
        }
        const pDev = projectDevMap.get(assigneeId)!;
        pDev.assigned++;
        pDev.projectsMap[proj.id].assigned++;

        const isResolved = isResolvedOrClosed(st);
        if (isResolved) {
          sysDev.resolved++;
          pDev.resolved++;
          sysDev.projectsMap[proj.id].resolved++;
          pDev.projectsMap[proj.id].resolved++;
        } else {
          sysDev.active++;
          pDev.active++;
        }
      }

      const stUpper = st.toUpperCase();
      if (stUpper === "CLOSED") {
        projClosed++;
        allClosedIssues++;
      } else if (stUpper === "FIXED" || stUpper === "VERIFIED" || customDoneKeys.has(st)) {
        projResolved++;
        allResolvedIssues++;
      } else if (stUpper === "IN_PROGRESS") {
        projInProgress++;
        allInProgressIssues++;
      } else {
        projOpen++;
        allOpenIssues++;
      }

      // Turnaround duration if issue resolved
      if (isResolvedOrClosed(st)) {
        if (issue.assigneeId) {
          memberResolvedCount[issue.assigneeId] = (memberResolvedCount[issue.assigneeId] || 0) + 1;
        }

        let resolvedAt: Date | null = null;
        for (const h of issue.history) {
          if (h.newValue && isResolvedOrClosed(h.newValue)) {
            resolvedAt = h.changedAt;
            break;
          }
        }
        if (!resolvedAt) {
          resolvedAt = issue.updatedAt;
        }

        const durationMs = Math.max(0, resolvedAt.getTime() - issue.createdAt.getTime());
        const durationHours = durationMs / (1000 * 60 * 60);
        projResolutionDurationsHours.push(durationHours);
        allResolutionDurationsHours.push(durationHours);

        if (issue.assignee) {
          systemDevMap.get(issue.assignee.id)?.resolutionHours.push(durationHours);
          projectDevMap.get(issue.assignee.id)?.resolutionHours.push(durationHours);
        }
      }
    }

    const projAvgHours =
      projResolutionDurationsHours.length > 0
        ? projResolutionDurationsHours.reduce((a, b) => a + b, 0) /
          projResolutionDurationsHours.length
        : 0;

    const projResolvedTotal = projResolved + projClosed;
    const projResolutionRate =
      projTotalIssues > 0
        ? Number(((projResolvedTotal / projTotalIssues) * 100).toFixed(1))
        : 0;

    const membersWorkload: ProjectMemberWorkload[] = proj.members.map((pm) => ({
      id: pm.user.id,
      name: pm.user.name,
      email: pm.user.email,
      roleInProject: pm.roleInProject,
      assignedIssuesCount: memberAssignedCount[pm.userId] || 0,
      resolvedIssuesCount: memberResolvedCount[pm.userId] || 0,
      raisedIssuesCount: memberRaisedCount[pm.userId] || 0,
    }));

    // Developer performance in this project
    const projDevelopers: DeveloperPerformance[] = Array.from(projectDevMap.values()).map((dev) => {
      const avgH =
        dev.resolutionHours.length > 0
          ? dev.resolutionHours.reduce((a, b) => a + b, 0) / dev.resolutionHours.length
          : 0;
      const rate = dev.assigned > 0 ? Number(((dev.resolved / dev.assigned) * 100).toFixed(1)) : 0;
      return {
        id: dev.user.id,
        name: dev.user.name,
        email: dev.user.email,
        assignedCount: dev.assigned,
        resolvedCount: dev.resolved,
        activeCount: dev.active,
        resolutionRate: rate,
        avgResolutionHours: Number(avgH.toFixed(1)),
        avgResolutionFormatted: formatDuration(avgH),
        projects: Object.entries(dev.projectsMap).map(([pId, info]) => ({
          projectId: pId,
          projectKey: info.projectKey,
          projectName: info.projectName,
          assigned: info.assigned,
          resolved: info.resolved,
        })),
      };
    });

    // Tester performance in this project
    const projTesters: TesterPerformance[] = Array.from(projectTesterMap.values()).map((t) => ({
      id: t.user.id,
      name: t.user.name,
      email: t.user.email,
      totalRaised: t.totalRaised,
      byProject: Object.entries(t.byProject).map(([pId, info]) => ({
        projectId: pId,
        projectKey: info.projectKey,
        projectName: info.projectName,
        count: info.count,
      })),
      bySeverity: t.bySeverity,
      byStatus: t.byStatus,
    }));

    // Top 5 recent issues
    const recentIssues: RecentIssueItem[] = projIssues.slice(0, 5).map((iss) => ({
      id: iss.id,
      number: iss.number,
      key: `${proj.key}-${iss.number}`,
      title: iss.title,
      status: iss.status,
      severity: iss.severity,
      priority: iss.priority,
      createdAt: iss.createdAt.toISOString(),
      reporterName: iss.reporter?.name || "Unknown",
      assigneeName: iss.assignee?.name || null,
    }));

    projectAnalyticsList.push({
      id: proj.id,
      name: proj.name,
      key: proj.key,
      description: proj.description,
      createdAt: proj.createdAt.toISOString(),
      membersCount: proj.members.length,
      totalIssues: projTotalIssues,
      openIssues: projOpen,
      inProgressIssues: projInProgress,
      resolvedIssues: projResolved,
      closedIssues: projClosed,
      avgResolutionHours: Number(projAvgHours.toFixed(1)),
      avgResolutionFormatted: formatDuration(projAvgHours),
      resolutionRatePercent: projResolutionRate,
      statusBreakdown: projStatusCounts,
      severityBreakdown: projSeverityCounts,
      priorityBreakdown: projPriorityCounts,
      developers: projDevelopers,
      testers: projTesters,
      members: membersWorkload,
      recentIssues,
    });
  }

  // System developers list
  const systemDevelopers: DeveloperPerformance[] = Array.from(systemDevMap.values()).map((dev) => {
    const avgH =
      dev.resolutionHours.length > 0
        ? dev.resolutionHours.reduce((a, b) => a + b, 0) / dev.resolutionHours.length
        : 0;
    const rate = dev.assigned > 0 ? Number(((dev.resolved / dev.assigned) * 100).toFixed(1)) : 0;
    return {
      id: dev.user.id,
      name: dev.user.name,
      email: dev.user.email,
      assignedCount: dev.assigned,
      resolvedCount: dev.resolved,
      activeCount: dev.active,
      resolutionRate: rate,
      avgResolutionHours: Number(avgH.toFixed(1)),
      avgResolutionFormatted: formatDuration(avgH),
      projects: Object.entries(dev.projectsMap).map(([pId, info]) => ({
        projectId: pId,
        projectKey: info.projectKey,
        projectName: info.projectName,
        assigned: info.assigned,
        resolved: info.resolved,
      })),
    };
  });

  // System testers list
  const systemTesters: TesterPerformance[] = Array.from(systemTesterMap.values()).map((t) => ({
    id: t.user.id,
    name: t.user.name,
    email: t.user.email,
    totalRaised: t.totalRaised,
    byProject: Object.entries(t.byProject).map(([pId, info]) => ({
      projectId: pId,
      projectKey: info.projectKey,
      projectName: info.projectName,
      count: info.count,
    })),
    bySeverity: t.bySeverity,
    byStatus: t.byStatus,
  }));

  const systemAvgHours =
    allResolutionDurationsHours.length > 0
      ? allResolutionDurationsHours.reduce((a, b) => a + b, 0) /
        allResolutionDurationsHours.length
      : 0;

  const systemResolvedTotal = allResolvedIssues + allClosedIssues;
  const systemResolutionRate =
    allIssuesCount > 0
      ? Number(((systemResolvedTotal / allIssuesCount) * 100).toFixed(1))
      : 0;

  const activeProjectsCount = rawProjects.filter(
    (p) => p.issues.length > 0 || p.members.length > 0
  ).length;

  const statusColors: Record<string, string> = {
    REPORTED: "#EF4444",
    TRIAGED: "#F59E0B",
    IN_PROGRESS: "#3B82F6",
    FIXED: "#10B981",
    VERIFIED: "#06B6D4",
    CLOSED: "#64748B",
  };

  const statusDistribution = Object.entries(systemStatusCounts).map(([status, count]) => ({
    status,
    label: status.replace(/_/g, " "),
    count,
    percentage:
      allIssuesCount > 0 ? Number(((count / allIssuesCount) * 100).toFixed(1)) : 0,
    color: statusColors[status.toUpperCase()] || "#6366F1",
  }));

  const severityColors: Record<string, string> = {
    CRITICAL: "#DC2626",
    HIGH: "#EA580C",
    MEDIUM: "#F59E0B",
    LOW: "#10B981",
  };

  const severityDistribution = ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => ({
    severity: sev,
    count: systemSeverityCounts[sev] || 0,
    percentage:
      allIssuesCount > 0
        ? Number((((systemSeverityCounts[sev] || 0) / allIssuesCount) * 100).toFixed(1))
        : 0,
    color: severityColors[sev],
  }));

  const priorityColors: Record<string, string> = {
    URGENT: "#E11D48",
    HIGH: "#F97316",
    MEDIUM: "#3B82F6",
    LOW: "#64748B",
  };

  const priorityDistribution = ["URGENT", "HIGH", "MEDIUM", "LOW"].map((prio) => ({
    priority: prio,
    count: systemPriorityCounts[prio] || 0,
    percentage:
      allIssuesCount > 0
        ? Number((((systemPriorityCounts[prio] || 0) / allIssuesCount) * 100).toFixed(1))
        : 0,
    color: priorityColors[prio],
  }));

  return {
    overview: {
      totalUsers,
      adminCount,
      memberCount,
      totalProjects: rawProjects.length,
      activeProjects: activeProjectsCount,
      totalIssues: allIssuesCount,
      openIssues: allOpenIssues,
      inProgressIssues: allInProgressIssues,
      resolvedIssues: allResolvedIssues,
      closedIssues: allClosedIssues,
      avgResolutionHours: Number(systemAvgHours.toFixed(1)),
      avgResolutionFormatted: formatDuration(systemAvgHours),
      resolutionRatePercent: systemResolutionRate,
    },
    statusDistribution,
    severityDistribution,
    priorityDistribution,
    developers: systemDevelopers,
    testers: systemTesters,
    projects: projectAnalyticsList,
  };
}

export async function getSystemAnalyticsAction(): Promise<{
  success: boolean;
  data?: SystemAnalyticsData;
  error?: string;
}> {
  try {
    await requireAdmin();
    const data = await getSystemAnalyticsData();
    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load system analytics";
    return { success: false, error: message };
  }
}
