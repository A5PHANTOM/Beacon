import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Defs,
  LinearGradient,
  Stop,
  Rect,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { SystemAnalyticsData, ProjectAnalyticsData } from "@/app/(dashboard)/admin/analytics/actions";

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 40,
    paddingHorizontal: 32,
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
    color: "#0F172A",
    fontSize: 9,
    lineHeight: 1.4,
  },
  // Header section
  headerWrapper: {
    marginBottom: 18,
    borderRadius: 8,
    overflow: "hidden",
  },
  headerBanner: {
    backgroundColor: "#1E3A8A",
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#3B82F6",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: "#93C5FD",
    fontSize: 9,
    marginTop: 2,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerBadge: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    color: "#FFFFFF",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  headerDate: {
    color: "#BFDBFE",
    fontSize: 8,
    marginTop: 3,
  },

  // Metadata strip
  metaStrip: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 16,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaLabel: {
    color: "#64748B",
    fontSize: 8,
    marginRight: 4,
  },
  metaValue: {
    color: "#1E293B",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderLeftWidth: 3,
    borderLeftColor: "#2563EB",
    borderRadius: 6,
    padding: 10,
  },
  kpiLabel: {
    color: "#64748B",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  kpiValue: {
    color: "#1E3A8A",
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
  kpiSubtext: {
    color: "#3B82F6",
    fontSize: 7.5,
    marginTop: 2,
  },

  // Section Heading
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: "#DBEAFE",
    paddingBottom: 4,
  },
  sectionHeadingIndicator: {
    width: 3,
    height: 12,
    backgroundColor: "#2563EB",
    marginRight: 6,
    borderRadius: 1,
  },
  sectionHeadingTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1E3A8A",
  },

  // Two columns container
  twoCols: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  col: {
    flex: 1,
  },

  // Table Styles
  table: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    borderBottomWidth: 1,
    borderBottomColor: "#BFDBFE",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    color: "#1E3A8A",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: "#F8FAFC",
  },
  tableCell: {
    fontSize: 8,
    color: "#334155",
  },
  tableCellBold: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#0F172A",
  },

  // Bar progress in tables
  progressContainer: {
    height: 5,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    overflow: "hidden",
    flex: 1,
    marginRight: 6,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 2,
  },

  // Badges
  statusBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 6,
    color: "#94A3B8",
    fontSize: 7.5,
  },
});

interface AnalyticsPdfProps {
  systemData: SystemAnalyticsData;
  projectData?: ProjectAnalyticsData;
  generatedBy?: string;
  generatedAt?: string;
}

export function AnalyticsPdfDocument({
  systemData,
  projectData,
  generatedBy = "System Administrator",
  generatedAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
}: AnalyticsPdfProps) {
  const isProjectSpecific = !!projectData;

  return (
    <Document title={isProjectSpecific ? `Beacon Project Analytics - ${projectData.name}` : "Beacon System Analytics"}>
      <Page size="A4" style={styles.page}>
        {/* TOP BANNER */}
        <View style={styles.headerWrapper}>
          <View style={styles.headerBanner}>
            <View style={styles.headerLeft}>
              <View style={styles.logoIcon}>
                <Text style={styles.logoText}>B</Text>
              </View>
              <View>
                <Text style={styles.headerTitle}>BEACON ANALYTICS</Text>
                <Text style={styles.headerSubtitle}>
                  {isProjectSpecific
                    ? `Project Performance Audit: ${projectData.name} (${projectData.key})`
                    : "Comprehensive System & Portfolio Performance Report"}
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.headerBadge}>CONFIDENTIAL / INTERNAL</Text>
              <Text style={styles.headerDate}>{generatedAt}</Text>
            </View>
          </View>
        </View>

        {/* METADATA STRIP */}
        <View style={styles.metaStrip}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Generated By:</Text>
            <Text style={styles.metaValue}>{generatedBy}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Scope:</Text>
            <Text style={styles.metaValue}>{isProjectSpecific ? `Project [${projectData.key}]` : "All Projects & Teams"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>System Version:</Text>
            <Text style={styles.metaValue}>Beacon v0.1.0 Enterprise</Text>
          </View>
        </View>

        {/* KPI METRIC CARDS */}
        {isProjectSpecific ? (
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Team Members</Text>
              <Text style={styles.kpiValue}>{projectData.membersCount}</Text>
              <Text style={styles.kpiSubtext}>Active project staff</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Issues</Text>
              <Text style={styles.kpiValue}>{projectData.totalIssues}</Text>
              <Text style={styles.kpiSubtext}>
                {projectData.openIssues} open • {projectData.inProgressIssues} active
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Avg Resolution Time</Text>
              <Text style={styles.kpiValue}>{projectData.avgResolutionFormatted}</Text>
              <Text style={styles.kpiSubtext}>Turnaround duration</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Resolution Rate</Text>
              <Text style={styles.kpiValue}>{projectData.resolutionRatePercent}%</Text>
              <Text style={styles.kpiSubtext}>
                {projectData.resolvedIssues + projectData.closedIssues} of {projectData.totalIssues} resolved
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Users</Text>
              <Text style={styles.kpiValue}>{systemData.overview.totalUsers}</Text>
              <Text style={styles.kpiSubtext}>
                {systemData.overview.adminCount} Admins • {systemData.overview.memberCount} Members
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Active Projects</Text>
              <Text style={styles.kpiValue}>{systemData.overview.activeProjects}</Text>
              <Text style={styles.kpiSubtext}>Of {systemData.overview.totalProjects} total registered</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Issues</Text>
              <Text style={styles.kpiValue}>{systemData.overview.totalIssues}</Text>
              <Text style={styles.kpiSubtext}>
                {systemData.overview.openIssues} Open • {systemData.overview.inProgressIssues} In Progress
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Avg Resolution Time</Text>
              <Text style={styles.kpiValue}>{systemData.overview.avgResolutionFormatted}</Text>
              <Text style={styles.kpiSubtext}>{systemData.overview.resolutionRatePercent}% Resolved Rate</Text>
            </View>
          </View>
        )}

        {/* DISTRIBUTION SECTIONS: STATUS & SEVERITY */}
        <View style={styles.twoCols}>
          {/* Status Breakdown Table */}
          <View style={styles.col}>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionHeadingIndicator} />
              <Text style={styles.sectionHeadingTitle}>Issue Status Distribution</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Status</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>Count</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: "right" }]}>Share</Text>
              </View>
              {(isProjectSpecific
                ? Object.entries(projectData.statusBreakdown).map(([status, count]) => {
                    const total = projectData.totalIssues || 1;
                    return {
                      status,
                      label: status.replace(/_/g, " "),
                      count,
                      percentage: Number(((count / total) * 100).toFixed(1)),
                    };
                  })
                : systemData.statusDistribution
              ).map((row, idx) => (
                <View key={row.status} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                  <Text style={[styles.tableCellBold, { flex: 2 }]}>{row.label || row.status}</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>{row.count}</Text>
                  <View style={{ flex: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
                    <View style={styles.progressContainer}>
                      <View style={[styles.progressBar, { width: `${Math.min(100, row.percentage)}%` }]} />
                    </View>
                    <Text style={[styles.tableCell, { width: 28, textAlign: "right" }]}>{row.percentage}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Severity Breakdown Table */}
          <View style={styles.col}>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionHeadingIndicator} />
              <Text style={styles.sectionHeadingTitle}>Severity & Risk Profile</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Severity</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>Count</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: "right" }]}>Distribution</Text>
              </View>
              {(isProjectSpecific
                ? ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => {
                    const count = projectData.severityBreakdown[sev] || 0;
                    const total = projectData.totalIssues || 1;
                    return {
                      severity: sev,
                      count,
                      percentage: Number(((count / total) * 100).toFixed(1)),
                      color: sev === "CRITICAL" ? "#DC2626" : sev === "HIGH" ? "#EA580C" : sev === "MEDIUM" ? "#F59E0B" : "#10B981",
                    };
                  })
                : systemData.severityDistribution
              ).map((row, idx) => (
                <View key={row.severity} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                  <Text style={[styles.tableCellBold, { flex: 2, color: row.color }]}>{row.severity}</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>{row.count}</Text>
                  <View style={{ flex: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
                    <View style={styles.progressContainer}>
                      <View
                        style={[
                          styles.progressBar,
                          {
                            width: `${Math.min(100, row.percentage)}%`,
                            backgroundColor: row.color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.tableCell, { width: 28, textAlign: "right" }]}>{row.percentage}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* BOTTOM SECTION: PROJECT MATRIX (IF SYSTEM) OR TEAM WORKLOAD (IF PROJECT SPECIFIC) */}
        {isProjectSpecific ? (
          <View>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionHeadingIndicator} />
              <Text style={styles.sectionHeadingTitle}>Team Member Workload & Contributions</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Member</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Email</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Role</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>Assigned</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>Resolved</Text>
              </View>
              {projectData.members.length === 0 ? (
                <View style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: "center", color: "#94A3B8" }]}>
                    No team members assigned to this project yet.
                  </Text>
                </View>
              ) : (
                projectData.members.map((m, idx) => (
                  <View key={m.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                    <Text style={[styles.tableCellBold, { flex: 2 }]}>{m.name}</Text>
                    <Text style={[styles.tableCell, { flex: 2, color: "#64748B" }]}>{m.email}</Text>
                    <Text style={[styles.tableCell, { flex: 1.2 }]}>{m.roleInProject}</Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>{m.assignedIssuesCount}</Text>
                    <Text style={[styles.tableCellBold, { flex: 1, textAlign: "right", color: "#16A34A" }]}>
                      {m.resolvedIssuesCount}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* Recent issues */}
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionHeadingIndicator} />
              <Text style={styles.sectionHeadingTitle}>Recent Issues in Project</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Key</Text>
                <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Title</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Status</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Severity</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Assignee</Text>
              </View>
              {projectData.recentIssues.length === 0 ? (
                <View style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: "center", color: "#94A3B8" }]}>
                    No issues recorded for this project yet.
                  </Text>
                </View>
              ) : (
                projectData.recentIssues.map((iss, idx) => (
                  <View key={iss.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                    <Text style={[styles.tableCellBold, { flex: 1, color: "#2563EB" }]}>{iss.key}</Text>
                    <Text style={[styles.tableCell, { flex: 3 }]}>
                      {iss.title}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1.2 }]}>{iss.status}</Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{iss.severity}</Text>
                    <Text style={[styles.tableCell, { flex: 1.5, color: "#64748B" }]}>
                      {iss.assigneeName || "Unassigned"}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : (
          <View>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionHeadingIndicator} />
              <Text style={styles.sectionHeadingTitle}>Project Performance & Metrics Matrix</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Key</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>Project Name</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: "right" }]}>Staff</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: "right" }]}>Total</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: "right" }]}>Open</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: "right" }]}>Active</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: "right" }]}>Resolved</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: "right" }]}>Avg Turnaround</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: "right" }]}>Resolution %</Text>
              </View>
              {systemData.projects.map((p, idx) => (
                <View key={p.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                  <Text style={[styles.tableCellBold, { flex: 0.8, color: "#2563EB" }]}>{p.key}</Text>
                  <Text style={[styles.tableCellBold, { flex: 2.2 }]}>
                    {p.name}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 0.8, textAlign: "right" }]}>{p.membersCount}</Text>
                  <Text style={[styles.tableCell, { flex: 0.8, textAlign: "right" }]}>{p.totalIssues}</Text>
                  <Text style={[styles.tableCell, { flex: 0.8, textAlign: "right", color: "#DC2626" }]}>
                    {p.openIssues}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 0.8, textAlign: "right", color: "#2563EB" }]}>
                    {p.inProgressIssues}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 0.8, textAlign: "right", color: "#16A34A" }]}>
                    {p.resolvedIssues + p.closedIssues}
                  </Text>
                  <Text style={[styles.tableCellBold, { flex: 1.2, textAlign: "right" }]}>
                    {p.avgResolutionFormatted}
                  </Text>
                  <Text style={[styles.tableCellBold, { flex: 1.2, textAlign: "right", color: "#2563EB" }]}>
                    {p.resolutionRatePercent}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* FOOTER */}
        <View style={styles.footer} fixed>
          <Text>Beacon Issue Tracker — Generated Confidential Administrative Audit</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function generateAnalyticsPdfBuffer(props: AnalyticsPdfProps): Promise<Buffer> {
  const element = React.createElement(AnalyticsPdfDocument, props);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);
  return buffer;
}
