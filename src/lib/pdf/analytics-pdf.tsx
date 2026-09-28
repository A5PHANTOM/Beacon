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
              <Text style={styles.kpiLabel}>QA Raised</Text>
              <Text style={[styles.kpiValue, { color: "#DC2626" }]}>
                {projectData.testers.reduce((acc, t) => acc + t.totalRaised, 0)}
              </Text>
              <Text style={styles.kpiSubtext}>{projectData.testers.length} QA reporters</Text>
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
              <Text style={styles.kpiSubtext}>Of {systemData.overview.totalProjects} registered</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Issues</Text>
              <Text style={styles.kpiValue}>{systemData.overview.totalIssues}</Text>
              <Text style={styles.kpiSubtext}>
                {systemData.overview.openIssues} Open • {systemData.overview.inProgressIssues} Active
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>QA Raised</Text>
              <Text style={[styles.kpiValue, { color: "#DC2626" }]}>
                {systemData.testers.reduce((acc, t) => acc + t.totalRaised, 0)}
              </Text>
              <Text style={styles.kpiSubtext}>Across {systemData.testers.length} testers</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Avg Resolution</Text>
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
              <Text style={styles.sectionHeadingTitle}>Domain & Category Breakdown</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Domain (UI / Backend / AI)</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>Count</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: "right" }]}>Distribution</Text>
              </View>
              {(isProjectSpecific
                ? ["UI", "BACKEND", "AI"].map((sev) => {
                    const count = projectData.severityBreakdown[sev] || 0;
                    const total = projectData.totalIssues || 1;
                    return {
                      severity: sev === "BACKEND" ? "Backend" : sev,
                      count,
                      percentage: Number(((count / total) * 100).toFixed(1)),
                      color: sev === "UI" ? "#8B5CF6" : sev === "BACKEND" ? "#10B981" : sev === "AI" ? "#EC4899" : "#64748B",
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

        {/* DEVELOPER VELOCITY & TESTER BUG REPORTING TABLES */}
        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionHeadingIndicator} />
          <Text style={styles.sectionHeadingTitle}>Developer Issue Resolution & Velocity</Text>
        </View>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Developer</Text>
            <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>Email</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>Assigned</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>Resolved</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: "right" }]}>Turnaround</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: "right" }]}>Success %</Text>
          </View>
          {(isProjectSpecific ? projectData.developers : systemData.developers).length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1, textAlign: "center", color: "#94A3B8" }]}>
                No developer issue assignments recorded.
              </Text>
            </View>
          ) : (
            (isProjectSpecific ? projectData.developers : systemData.developers).map((dev, idx) => (
              <View key={dev.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCellBold, { flex: 2 }]}>{dev.name}</Text>
                <Text style={[styles.tableCell, { flex: 2.2, color: "#64748B" }]}>{dev.email}</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>{dev.assignedCount}</Text>
                <Text style={[styles.tableCellBold, { flex: 1, textAlign: "right", color: "#16A34A" }]}>
                  {dev.resolvedCount}
                </Text>
                <Text style={[styles.tableCell, { flex: 1.2, textAlign: "right" }]}>{dev.avgResolutionFormatted}</Text>
                <Text style={[styles.tableCellBold, { flex: 1.2, textAlign: "right", color: "#2563EB" }]}>
                  {dev.resolutionRate}%
                </Text>
              </View>
            ))
          )}
        </View>

        {/* TESTER ISSUES RAISED ACCORDING TO PROJECT TABLE */}
        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionHeadingIndicator} />
          <Text style={styles.sectionHeadingTitle}>QA & Tester Bug Reporting (Number of Issues Raised by Project)</Text>
        </View>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Tester</Text>
            <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Issues Raised by Project</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>Critical</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>High</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.4, textAlign: "right" }]}>Issues Raised</Text>
          </View>
          {(isProjectSpecific ? projectData.testers : systemData.testers).length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1, textAlign: "center", color: "#94A3B8" }]}>
                No issues logged by testers recorded.
              </Text>
            </View>
          ) : (
            (isProjectSpecific ? projectData.testers : systemData.testers).map((t, idx) => (
              <View key={t.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCellBold, { flex: 2 }]}>{t.name}</Text>
                <Text style={[styles.tableCell, { flex: 3, color: "#2563EB" }]}>
                  {t.byProject.map((p) => `${p.projectKey}: ${p.count}`).join(" • ")}
                </Text>
                <Text style={[styles.tableCellBold, { flex: 1, textAlign: "right", color: "#DC2626" }]}>
                  {t.bySeverity.CRITICAL}
                </Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: "right", color: "#EA580C" }]}>
                  {t.bySeverity.HIGH}
                </Text>
                <Text style={[styles.tableCellBold, { flex: 1.4, textAlign: "right", color: "#DC2626" }]}>
                  {t.totalRaised} issues
                </Text>
              </View>
            ))
          )}
        </View>

        {/* BOTTOM SECTION: PROJECT MATRIX (IF SYSTEM) OR RECENT ISSUES (IF PROJECT SPECIFIC) */}
        {isProjectSpecific ? (
          <View>
            {/* Recent issues */}
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionHeadingIndicator} />
              <Text style={styles.sectionHeadingTitle}>Recent Project Tickets</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Key</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>Title</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Status</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Reporter</Text>
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
                    <Text style={[styles.tableCell, { flex: 2.5 }]}>
                      {iss.title}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1.2 }]}>{iss.status}</Text>
                    <Text style={[styles.tableCell, { flex: 1.5, color: "#64748B" }]}>
                      {iss.reporterName}
                    </Text>
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
                <Text style={[styles.tableHeaderCell, { flex: 2.0 }]}>Project Name</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: "right" }]}>Staff</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: "right" }]}>Total</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.9, textAlign: "right" }]}>QA Raised</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: "right" }]}>Open</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: "right" }]}>Active</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: "right" }]}>Resolved</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.1, textAlign: "right" }]}>Turnaround</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.1, textAlign: "right" }]}>Resolution %</Text>
              </View>
              {systemData.projects.map((p, idx) => (
                <View key={p.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                  <Text style={[styles.tableCellBold, { flex: 0.8, color: "#2563EB" }]}>{p.key}</Text>
                  <Text style={[styles.tableCellBold, { flex: 2.0 }]}>
                    {p.name}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 0.7, textAlign: "right" }]}>{p.membersCount}</Text>
                  <Text style={[styles.tableCell, { flex: 0.7, textAlign: "right" }]}>{p.totalIssues}</Text>
                  <Text style={[styles.tableCellBold, { flex: 0.9, textAlign: "right", color: "#DC2626" }]}>
                    {p.testers.reduce((acc, t) => acc + t.totalRaised, 0)}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 0.7, textAlign: "right", color: "#DC2626" }]}>
                    {p.openIssues}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 0.7, textAlign: "right", color: "#2563EB" }]}>
                    {p.inProgressIssues}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 0.7, textAlign: "right", color: "#16A34A" }]}>
                    {p.resolvedIssues + p.closedIssues}
                  </Text>
                  <Text style={[styles.tableCellBold, { flex: 1.1, textAlign: "right" }]}>
                    {p.avgResolutionFormatted}
                  </Text>
                  <Text style={[styles.tableCellBold, { flex: 1.1, textAlign: "right", color: "#2563EB" }]}>
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
