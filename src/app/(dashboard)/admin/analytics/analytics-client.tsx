"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Users,
  FolderKanban,
  Layers,
  Clock,
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  BarChart3,
  HardDrive,
  ExternalLink,
  Code2,
  Bug,
  Award,
  Zap,
  Activity,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Flame,
} from "lucide-react";
import type {
  SystemAnalyticsData,
  ProjectAnalyticsData,
  DeveloperPerformance,
  TesterPerformance,
} from "./actions";
import { getSystemAnalyticsAction } from "./actions";
import { Pagination } from "@/components/ui/pagination";

export function AnalyticsClient({
  initialData,
}: {
  initialData: SystemAnalyticsData;
}) {
  const [data, setData] = useState<SystemAnalyticsData>(initialData);
  const [activeTab, setActiveTab] = useState<"system" | "project">("system");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialData.projects[0]?.id || ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pagination states
  const [projectMatrixPage, setProjectMatrixPage] = useState<number>(1);
  const [projectMatrixPageSize, setProjectMatrixPageSize] = useState<number>(10);
  const [testerPage, setTesterPage] = useState<number>(1);
  const [testerPageSize, setTesterPageSize] = useState<number>(10);
  const [workloadPage, setWorkloadPage] = useState<number>(1);
  const [workloadPageSize, setWorkloadPageSize] = useState<number>(10);
  const [recentIssuesPage, setRecentIssuesPage] = useState<number>(1);
  const [recentIssuesPageSize, setRecentIssuesPageSize] = useState<number>(10);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await getSystemAnalyticsAction();
      if (res.success && res.data) {
        setData(res.data);
        showToast("Analytics metrics refreshed successfully");
      } else {
        showToast(res.error || "Failed to refresh data");
      }
    } catch {
      showToast("Error refreshing metrics");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDownloadPdf = async (projectId?: string) => {
    const key = projectId || "system";
    setDownloadingPdf(key);
    showToast(
      projectId
        ? "Generating project PDF audit report..."
        : "Generating system executive PDF report..."
    );

    try {
      const url = projectId
        ? `/api/admin/analytics/pdf?projectId=${encodeURIComponent(projectId)}`
        : `/api/admin/analytics/pdf`;

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        projectId ? `beacon-project-${projectId}-analytics.pdf` : "beacon-system-analytics.pdf"
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      showToast("Failed to initiate PDF download");
    } finally {
      setDownloadingPdf(null);
    }
  };

  const selectedProject =
    data.projects.find((p) => p.id === selectedProjectId) || data.projects[0];

  const filteredProjects = data.projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const paginatedProjects = filteredProjects.slice(
    (projectMatrixPage - 1) * projectMatrixPageSize,
    projectMatrixPage * projectMatrixPageSize
  );

  const paginatedTesters = data.testers.slice(
    (testerPage - 1) * testerPageSize,
    testerPage * testerPageSize
  );

  const projectMembers = selectedProject?.members || [];
  const paginatedMembers = projectMembers.slice(
    (workloadPage - 1) * workloadPageSize,
    workloadPage * workloadPageSize
  );

  const projectRecentIssues = selectedProject?.recentIssues || [];
  const paginatedRecentIssues = projectRecentIssues.slice(
    (recentIssuesPage - 1) * recentIssuesPageSize,
    recentIssuesPage * recentIssuesPageSize
  );

  // Maximum issues assigned across developers for relative bar graphs
  const maxDevAssigned = Math.max(
    1,
    ...data.developers.map((d) => d.assignedCount)
  );

  // Maximum issues raised across testers for relative bar graphs
  const maxTesterRaised = Math.max(
    1,
    ...data.testers.map((t) => t.totalRaised)
  );

  // Total issues raised by testers across system and in the selected project
  const totalTesterIssues = data.testers.reduce((acc, t) => acc + t.totalRaised, 0);
  const selectedProjectTesterRaised = selectedProject
    ? selectedProject.testers.reduce((acc, t) => acc + t.totalRaised, 0)
    : 0;

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 20px 80px" }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-lg)",
            padding: "12px 20px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            gap: 10,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "var(--accent-soft)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles className="h-3 w-3" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Admin Navbar Tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid var(--border)",
          marginBottom: 24,
          paddingBottom: 10,
          overflowX: "auto",
        }}
      >
        <Link
          href="/admin/users"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 15px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            background: "transparent",
            color: "var(--text-dim)",
            border: "1px solid transparent",
            transition: "all 0.15s ease",
          }}
        >
          <Users className="h-4 w-4" />
          <span>Team & Users</span>
        </Link>
        <Link
          href="/admin/statuses"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 15px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            background: "transparent",
            color: "var(--text-dim)",
            border: "1px solid transparent",
            transition: "all 0.15s ease",
          }}
        >
          <Layers className="h-4 w-4" />
          <span>Workflow & Statuses</span>
        </Link>
        <Link
          href="/admin/usage"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 15px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            background: "transparent",
            color: "var(--text-dim)",
            border: "1px solid transparent",
            transition: "all 0.15s ease",
          }}
        >
          <HardDrive className="h-4 w-4" />
          <span>Storage & Usage</span>
        </Link>
        <Link
          href="/admin/analytics"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 15px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            border: "1px solid var(--accent)",
          }}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Analytics & Reports</span>
        </Link>
      </div>

      {/* Main Page Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "var(--text)", letterSpacing: "-0.025em" }}>
              Analytics & Performance
            </h1>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 9px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                background: "var(--ok-soft)",
                color: "var(--ok)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--ok)",
                }}
              />
              Live Sync
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-dim)" }}>
            Real-time developer velocity, tester bug reporting by project, risk profiling, and exportable PDF audits.
          </p>
        </div>

        {/* Top Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <RefreshCw
              className="h-3.5 w-3.5"
              style={{ animation: isRefreshing ? "spin 1s linear infinite" : "none" }}
            />
            <span>Refresh</span>
          </button>

          {/* Premium Blue-Gradient Download PDF Button */}
          <button
            type="button"
            onClick={() => handleDownloadPdf()}
            disabled={downloadingPdf === "system"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #38bdf8 100%)",
              color: "#ffffff",
              border: "none",
              boxShadow: "0 2px 10px rgba(37, 99, 235, 0.35)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Download className="h-4 w-4" />
            <span>{downloadingPdf === "system" ? "Generating..." : "Download System PDF"}</span>
          </button>
        </div>
      </div>

      {/* View Switcher Pills */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "var(--surface-2)",
          padding: 4,
          borderRadius: 10,
          border: "1px solid var(--border)",
          width: "fit-content",
          marginBottom: 24,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("system")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "6px 14px",
            borderRadius: 7,
            fontSize: 12.5,
            fontWeight: activeTab === "system" ? 700 : 500,
            background: activeTab === "system" ? "var(--surface)" : "transparent",
            color: activeTab === "system" ? "var(--text)" : "var(--text-dim)",
            border: activeTab === "system" ? "1px solid var(--border)" : "1px solid transparent",
            boxShadow: activeTab === "system" ? "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)" : "none",
            cursor: "pointer",
            transition: "all 0.12s ease",
          }}
        >
          <BarChart3 className="h-3.5 w-3.5" style={{ color: activeTab === "system" ? "var(--accent)" : "currentColor" }} />
          <span>System Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("project")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "6px 14px",
            borderRadius: 7,
            fontSize: 12.5,
            fontWeight: activeTab === "project" ? 700 : 500,
            background: activeTab === "project" ? "var(--surface)" : "transparent",
            color: activeTab === "project" ? "var(--text)" : "var(--text-dim)",
            border: activeTab === "project" ? "1px solid var(--border)" : "1px solid transparent",
            boxShadow: activeTab === "project" ? "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)" : "none",
            cursor: "pointer",
            transition: "all 0.12s ease",
          }}
        >
          <FolderKanban className="h-3.5 w-3.5" style={{ color: activeTab === "project" ? "var(--accent)" : "currentColor" }} />
          <span>Project Deep-Dive</span>
          <span
            style={{
              padding: "1px 6px",
              borderRadius: 10,
              fontSize: 10.5,
              fontWeight: 700,
              background: "var(--accent-soft)",
              color: "var(--accent)",
            }}
          >
            {data.projects.length}
          </span>
        </button>
      </div>

      {activeTab === "system" ? (
        /* ========================================================== */
        /*                     SYSTEM OVERVIEW TAB                    */
        /* ========================================================== */
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* 5 Executive KPI Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 16,
            }}
          >
            {/* Card 1: Users */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "18px 20px",
                boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Total Users
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "var(--info-soft)",
                    color: "var(--info)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em" }}>
                  {data.overview.totalUsers}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>registered accounts</span>
              </div>
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: "1px solid var(--border)",
                  fontSize: 12,
                  color: "var(--text-dim)",
                  display: "flex",
                  gap: 10,
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--accent)" }}>
                  {data.overview.adminCount} Admins
                </span>
                <span>•</span>
                <span>{data.overview.memberCount} Members</span>
              </div>
            </div>

            {/* Card 2: Active Projects */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "18px 20px",
                boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Active Projects
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border)",
                  }}
                >
                  <FolderKanban className="h-4 w-4" />
                </div>
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em" }}>
                  {data.overview.activeProjects}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  of {data.overview.totalProjects} total
                </span>
              </div>
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: "1px solid var(--border)",
                  fontSize: 12,
                  color: "var(--text-dim)",
                  display: "flex",
                  gap: 10,
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--ok)" }}>100% Operational</span>
                <span>•</span>
                <span>Database tracked</span>
              </div>
            </div>

            {/* Card 3: Issue Volume */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "18px 20px",
                boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Total Issues
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "var(--warn-soft)",
                    color: "var(--warn)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Layers className="h-4 w-4" />
                </div>
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em" }}>
                  {data.overview.totalIssues}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>workspace total</span>
              </div>
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: "1px solid var(--border)",
                  fontSize: 12,
                  color: "var(--text-dim)",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--crit)" }}>{data.overview.openIssues} Open</span>
                <span>•</span>
                <span style={{ fontWeight: 600, color: "var(--info)" }}>{data.overview.inProgressIssues} Active</span>
                <span>•</span>
                <span style={{ fontWeight: 600, color: "var(--ok)" }}>
                  {data.overview.resolvedIssues + data.overview.closedIssues} Done
                </span>
              </div>
            </div>

            {/* Card 4: Issues Raised by QA/Testers */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "18px 20px",
                boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Issues Raised by Testers
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "var(--crit-soft)",
                    color: "var(--crit)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Bug className="h-4 w-4" />
                </div>
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: "var(--crit)", letterSpacing: "-0.03em" }}>
                  {totalTesterIssues}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>issues filed</span>
              </div>
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: "1px solid var(--border)",
                  fontSize: 12,
                  color: "var(--text-dim)",
                  display: "flex",
                  gap: 10,
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--text)" }}>
                  {data.testers.length} Active QA Testers
                </span>
                <span>•</span>
                <span>
                  {data.overview.totalIssues > 0
                    ? `${Math.round((totalTesterIssues / data.overview.totalIssues) * 100)}% of total`
                    : "0% of total"}
                </span>
              </div>
            </div>

            {/* Card 5: Avg Resolution Time */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "18px 20px",
                boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Avg Resolution Time
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "var(--ok-soft)",
                    color: "var(--ok)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: "var(--info)", letterSpacing: "-0.03em" }}>
                  {data.overview.avgResolutionFormatted}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>turnaround</span>
              </div>
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: "1px solid var(--border)",
                  fontSize: 12,
                  color: "var(--text-dim)",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontWeight: 700, color: "var(--ok)" }}>
                  {data.overview.resolutionRatePercent}% Resolved
                </span>
                <span style={{ color: "var(--text-faint)" }}>Ticket Close Rate</span>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/*   SYSTEM DISTRIBUTION METRICS: STATUS & SEVERITY & RISK  */}
          {/* ======================================================== */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: 16,
            }}
          >
            {/* Status Pipeline Distribution */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "20px 22px",
                boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Activity className="h-4 w-4" style={{ color: "var(--accent)" }} />
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                    Issue Lifecycle Distribution
                  </h3>
                </div>
                <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 600 }}>
                  {data.overview.totalIssues} Tickets Tracked
                </span>
              </div>

              {/* Segmented Bar */}
              <div
                style={{
                  height: 10,
                  borderRadius: 6,
                  overflow: "hidden",
                  display: "flex",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  marginBottom: 16,
                }}
              >
                {data.statusDistribution.map((st) => (
                  <div
                    key={st.status}
                    style={{
                      height: "100%",
                      width: `${st.percentage}%`,
                      background: st.color,
                      transition: "width 0.3s ease",
                    }}
                    title={`${st.label}: ${st.count} (${st.percentage}%)`}
                  />
                ))}
              </div>

              {/* Status Tags Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                {data.statusDistribution.map((st) => (
                  <div
                    key={st.status}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      fontSize: 11.5,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.color }} />
                      <span style={{ fontWeight: 600 }}>{st.label}</span>
                    </span>
                    <span style={{ fontWeight: 700, color: "var(--text-dim)", fontFamily: "monospace" }}>
                      {st.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Severity & Risk Breakdown */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "20px 22px",
                boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Flame className="h-4 w-4" style={{ color: "#8B5CF6" }} />
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                    Domain & Category Profile
                  </h3>
                </div>
                <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 600 }}>
                  UI • Backend • AI
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.severityDistribution.map((sev) => (
                  <div key={sev.severity} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: sev.color }}>{sev.severity}</span>
                      <span style={{ color: "var(--text-dim)", fontWeight: 600 }}>
                        {sev.count} issues ({sev.percentage}%)
                      </span>
                    </div>
                    <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden", border: "1px solid var(--border)" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${sev.percentage}%`,
                          background: sev.color,
                          borderRadius: 3,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/*          DEVELOPER RESOLUTION VELOCITY & GRAPHS          */}
          {/* ======================================================== */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "20px 22px",
              boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                paddingBottom: 16,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: "var(--info-soft)",
                    color: "var(--info)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Code2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                    Developer Issue Resolution & Turnaround Velocity
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
                    Assigned tickets vs solved tickets, resolution success rates, and turnaround speeds.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--info)" }} />
                  <span style={{ color: "var(--text-dim)" }}>Assigned</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--ok)" }} />
                  <span style={{ color: "var(--text-dim)" }}>Resolved</span>
                </span>
              </div>
            </div>

            {/* Developer Performance Graph (Comparative Bars) */}
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
              {data.developers.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
                  No issues have been assigned to developers yet.
                </div>
              ) : (
                data.developers.map((dev) => (
                  <div key={dev.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: "var(--text)" }}>{dev.name}</span>
                        <span style={{ color: "var(--text-faint)", fontSize: 11.5, fontFamily: "monospace" }}>
                          ({dev.email})
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>
                          {dev.resolvedCount} of {dev.assignedCount} resolved
                        </span>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: dev.resolutionRate >= 80 ? "var(--ok-soft)" : "var(--info-soft)",
                            color: dev.resolutionRate >= 80 ? "var(--ok)" : "var(--info)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {dev.resolutionRate}% success
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: "var(--surface-2)",
                            color: "var(--text-dim)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <Clock style={{ width: 11, height: 11 }} />
                          {dev.avgResolutionFormatted} turnaround
                        </span>
                      </div>
                    </div>

                    {/* Comparative Dual Bars */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {/* Assigned bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 60, fontSize: 11, color: "var(--text-dim)" }}>Assigned</span>
                        <div style={{ flex: 1, height: 8, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${(dev.assignedCount / maxDevAssigned) * 100}%`,
                              background: "linear-gradient(90deg, #3b82f6, #60a5fa)",
                              borderRadius: 4,
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                        <span style={{ width: 24, fontSize: 11, fontWeight: 700, color: "var(--text)", textAlign: "right" }}>
                          {dev.assignedCount}
                        </span>
                      </div>

                      {/* Resolved bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 60, fontSize: 11, color: "var(--text-dim)" }}>Resolved</span>
                        <div style={{ flex: 1, height: 8, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${(dev.resolvedCount / maxDevAssigned) * 100}%`,
                              background: "linear-gradient(90deg, #10b981, #34d399)",
                              borderRadius: 4,
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                        <span style={{ width: 24, fontSize: 11, fontWeight: 700, color: "var(--ok)", textAlign: "right" }}>
                          {dev.resolvedCount}
                        </span>
                      </div>
                    </div>

                    {/* Projects worked on pills */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Projects:</span>
                      {dev.projects.map((p) => (
                        <span
                          key={p.projectId}
                          style={{
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 600,
                            fontFamily: "monospace",
                            background: "var(--surface-2)",
                            color: "var(--text-dim)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {p.projectKey}: {p.resolved}/{p.assigned} resolved
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/*     TESTER BUG REPORTING BY PROJECT GRAPHS & STATS       */}
          {/* ======================================================== */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "20px 22px",
              boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                paddingBottom: 16,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: "var(--crit-soft)",
                    color: "var(--crit)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Bug className="h-4 w-4" />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                    Number of Issues Raised by Testers (Categorized by Project)
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
                    Total defect intake, severity breakdown, and project-by-project issue count per tester.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 800,
                    background: "var(--crit-soft)",
                    color: "var(--crit)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {totalTesterIssues} Total Issues Raised
                </span>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 700,
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {data.testers.length} Active QA Reporters
                </span>
              </div>
            </div>

            {/* Tester Performance Graph & Project Categorization */}
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 20 }}>
              {data.testers.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
                  No issues have been filed by testers yet.
                </div>
              ) : (
                data.testers.map((tester) => (
                  <div
                    key={tester.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      padding: "14px 16px",
                      borderRadius: 10,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 800, color: "var(--text)", fontSize: 14 }}>
                          {tester.name}
                        </span>
                        <span style={{ color: "var(--text-faint)", fontSize: 11.5, fontFamily: "monospace" }}>
                          ({tester.email})
                        </span>
                      </div>

                      {/* Prominent Number of Issues Raised Badge */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 12px",
                            borderRadius: 20,
                            background: "linear-gradient(135deg, #e11d48, #f43f5e)",
                            color: "#ffffff",
                            fontSize: 12.5,
                            fontWeight: 800,
                            boxShadow: "0 2px 6px rgba(225, 29, 72, 0.25)",
                          }}
                        >
                          <Bug style={{ width: 13, height: 13 }} />
                          <span>{tester.totalRaised} Issues Raised</span>
                        </div>

                        {/* Severity mini badges */}
                        <div style={{ display: "flex", gap: 4 }}>
                          {tester.bySeverity.CRITICAL > 0 && (
                            <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: "var(--crit-soft)", color: "var(--crit)", border: "1px solid var(--border)" }}>
                              {tester.bySeverity.CRITICAL} Critical
                            </span>
                          )}
                          {tester.bySeverity.HIGH > 0 && (
                            <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: "var(--warn-soft)", color: "var(--warn)", border: "1px solid var(--border)" }}>
                              {tester.bySeverity.HIGH} High
                            </span>
                          )}
                          {tester.bySeverity.MEDIUM > 0 && (
                            <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: "var(--surface)", color: "var(--text-dim)", border: "1px solid var(--border)" }}>
                              {tester.bySeverity.MEDIUM} Med
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Visual Volume Bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, height: 8, background: "var(--surface)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${(tester.totalRaised / maxTesterRaised) * 100}%`,
                            background: "linear-gradient(90deg, #f43f5e, #fb7185)",
                            borderRadius: 4,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-dim)" }}>
                        {((tester.totalRaised / data.overview.totalIssues) * 100).toFixed(0)}% of total issues
                      </span>
                    </div>

                    {/* Issues Raised According to Project (Prominent Cards) */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-dim)" }}>
                        Raised by Project:
                      </span>
                      {tester.byProject.map((proj) => (
                        <div
                          key={proj.projectId}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: 12,
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
                            color: "var(--text)",
                          }}
                        >
                          <span style={{ fontWeight: 800, fontFamily: "monospace", color: "var(--info)", background: "var(--info-soft)", padding: "1px 5px", borderRadius: 4, border: "1px solid var(--border)" }}>
                            {proj.projectKey}
                          </span>
                          <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>{proj.projectName}:</span>
                          <span style={{ fontWeight: 800, color: "var(--crit)" }}>{proj.count} issues raised</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Tester Summary Table */}
            {data.testers.length > 0 && (
              <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <h4 style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 10 }}>
                  Tester Bug Submissions Breakdown Table
                </h4>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)", color: "var(--text-faint)", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                        <th style={{ padding: "8px 12px" }}>Tester</th>
                        <th style={{ padding: "8px 12px", textAlign: "right" }}>Issues Raised</th>
                        <th style={{ padding: "8px 12px" }}>Projects Affected</th>
                        <th style={{ padding: "8px 12px", textAlign: "right" }}>Critical</th>
                        <th style={{ padding: "8px 12px", textAlign: "right" }}>High</th>
                        <th style={{ padding: "8px 12px", textAlign: "right" }}>Resolved So Far</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTesters.map((t, idx) => (
                        <tr key={t.id} style={{ borderBottom: idx === paginatedTesters.length - 1 ? "none" : "1px solid var(--border)" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text)" }}>
                            {t.name}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "var(--crit)" }}>
                            {t.totalRaised} issues
                          </td>
                          <td style={{ padding: "10px 12px", color: "var(--text-dim)" }}>
                            {t.byProject.map((p) => `${p.projectKey} (${p.count})`).join(", ")}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: t.bySeverity.CRITICAL > 0 ? "var(--crit)" : "var(--text-faint)" }}>
                            {t.bySeverity.CRITICAL}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: t.bySeverity.HIGH > 0 ? "var(--warn)" : "var(--text-faint)" }}>
                            {t.bySeverity.HIGH}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "var(--ok)" }}>
                            {t.byStatus.resolved + t.byStatus.closed} of {t.totalRaised}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {data.testers.length > testerPageSize && (
                  <div style={{ marginTop: 12 }}>
                    <Pagination
                      currentPage={testerPage}
                      totalItems={data.testers.length}
                      pageSize={testerPageSize}
                      onPageChange={setTesterPage}
                      pageSizeOptions={[5, 10, 20]}
                      onPageSizeChange={(newSize) => {
                        setTesterPageSize(newSize);
                        setTesterPage(1);
                      }}
                      itemLabel="testers"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/*             PROJECT PERFORMANCE MATRIX TABLE             */}
          {/* ======================================================== */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                  Project Performance Matrix
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
                  Compare project velocity, issue volume, and export individual PDF audits.
                </p>
              </div>

              {/* Search filter */}
              <div style={{ position: "relative", width: 220 }}>
                <Search
                  style={{
                    position: "absolute",
                    left: 10,
                    top: 8,
                    width: 14,
                    height: 14,
                    color: "var(--text-faint)",
                  }}
                />
                <input
                  type="text"
                  placeholder="Filter projects..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setProjectMatrixPage(1);
                  }}
                  style={{
                    width: "100%",
                    padding: "6px 10px 6px 30px",
                    borderRadius: 7,
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    fontSize: 12,
                    color: "var(--text)",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                <thead>
                  <tr
                    style={{
                      background: "var(--surface-2)",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-faint)",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    <th style={{ padding: "10px 18px" }}>Project</th>
                    <th style={{ padding: "10px 14px" }}>Staff</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Total</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>QA Raised</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Open</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Active</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Resolved</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Avg Turnaround</th>
                    <th style={{ padding: "10px 18px" }}>Resolution %</th>
                    <th style={{ padding: "10px 18px", textAlign: "right" }}>PDF Audit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: "28px", textAlign: "center", color: "var(--text-faint)" }}>
                        No projects match search query.
                      </td>
                    </tr>
                  ) : (
                    paginatedProjects.map((p, idx) => (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: idx === paginatedProjects.length - 1 ? "none" : "1px solid var(--border)",
                          cursor: "pointer",
                          transition: "background 0.1s ease",
                        }}
                        onClick={() => {
                          setSelectedProjectId(p.id);
                          setWorkloadPage(1);
                          setRecentIssuesPage(1);
                          setActiveTab("project");
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "12px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span
                              style={{
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                fontFamily: "monospace",
                                background: "var(--accent-soft)",
                                color: "var(--accent)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              {p.key}
                            </span>
                            <span style={{ fontWeight: 600, color: "var(--text)" }}>{p.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", color: "var(--text-dim)" }}>
                          {p.membersCount} members
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: "var(--text)" }}>
                          {p.totalIssues}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontSize: 11.5,
                              fontWeight: 800,
                              background: "var(--crit-soft)",
                              color: "var(--crit)",
                              border: "1px solid var(--border)",
                            }}
                            title={`${p.testers.reduce((acc, t) => acc + t.totalRaised, 0)} issues raised by testers`}
                          >
                            {p.testers.reduce((acc, t) => acc + t.totalRaised, 0)}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, color: "var(--crit)" }}>
                          {p.openIssues}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, color: "var(--info)" }}>
                          {p.inProgressIssues}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, color: "var(--ok)" }}>
                          {p.resolvedIssues + p.closedIssues}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: "var(--text)" }}>
                          {p.avgResolutionFormatted}
                        </td>
                        <td style={{ padding: "12px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div
                              style={{
                                width: 50,
                                height: 6,
                                borderRadius: 4,
                                background: "var(--surface-2)",
                                overflow: "hidden",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${p.resolutionRatePercent}%`,
                                  background: "linear-gradient(90deg, #2563eb, #38bdf8)",
                                  borderRadius: 4,
                                }}
                              />
                            </div>
                            <span style={{ fontWeight: 600, color: "var(--text)", fontSize: 12 }}>
                              {p.resolutionRatePercent}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 18px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(p.id)}
                              disabled={downloadingPdf === p.id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 8px",
                                borderRadius: 6,
                                fontSize: 11.5,
                                fontWeight: 600,
                                background: "var(--surface)",
                                color: "var(--info)",
                                border: "1px solid var(--border)",
                                cursor: "pointer",
                                transition: "all 0.12s ease",
                              }}
                            >
                              <Download style={{ width: 12, height: 12 }} />
                              <span>{downloadingPdf === p.id ? "..." : "PDF"}</span>
                            </button>
                            <Link
                              href={`/projects/${p.id}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 26,
                                height: 26,
                                borderRadius: 6,
                                border: "1px solid var(--border)",
                                color: "var(--text-faint)",
                                textDecoration: "none",
                              }}
                              title="Go to board"
                            >
                              <ExternalLink style={{ width: 12, height: 12 }} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredProjects.length > 0 && (
              <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
                <Pagination
                  currentPage={projectMatrixPage}
                  totalItems={filteredProjects.length}
                  pageSize={projectMatrixPageSize}
                  onPageChange={setProjectMatrixPage}
                  pageSizeOptions={[5, 10, 20, 50]}
                  onPageSizeChange={(newSize) => {
                    setProjectMatrixPageSize(newSize);
                    setProjectMatrixPage(1);
                  }}
                  itemLabel="projects"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================== */
        /*                  PROJECT DEEP-DIVE TAB                     */
        /* ========================================================== */
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Project Details Banner */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "18px 22px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
              boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 16,
                  fontFamily: "monospace",
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
                }}
              >
                {selectedProject?.key || "PRJ"}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--text)" }}>
                    {selectedProject?.name}
                  </h2>
                  <span
                    style={{
                      padding: "2px 7px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: "monospace",
                      fontWeight: 700,
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {selectedProject?.key}
                  </span>
                </div>
                <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--text-dim)" }}>
                  {selectedProject?.description || "No project description provided."}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* Project selector dropdown */}
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {data.projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name} ({proj.key})
                  </option>
                ))}
              </select>

              {/* Download project PDF */}
              <button
                type="button"
                onClick={() => handleDownloadPdf(selectedProject?.id)}
                disabled={downloadingPdf === selectedProject?.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "7px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #38bdf8 100%)",
                  color: "#ffffff",
                  border: "none",
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
                  cursor: "pointer",
                }}
              >
                <Download style={{ width: 14, height: 14 }} />
                <span>
                  {downloadingPdf === selectedProject?.id
                    ? "Generating..."
                    : `Download ${selectedProject?.key} PDF`}
                </span>
              </button>

              <Link
                href={`/projects/${selectedProject?.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  background: "var(--surface)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                }}
              >
                <span>Open Board</span>
                <ArrowUpRight style={{ width: 14, height: 14, color: "var(--text-faint)" }} />
              </Link>
            </div>
          </div>

          {/* Project KPI Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Total Issues
              </span>
              <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, color: "var(--text)" }}>
                {selectedProject?.totalIssues || 0}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-dim)" }}>
                {selectedProject?.openIssues || 0} Open • {selectedProject?.inProgressIssues || 0} In Progress
              </div>
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Issues Raised by Testers
                </span>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: "var(--crit-soft)",
                    color: "var(--crit)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Bug className="h-3.5 w-3.5" />
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, color: "var(--crit)" }}>
                {selectedProjectTesterRaised}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-dim)" }}>
                by {selectedProject?.testers.length || 0} QA testers ({selectedProject?.totalIssues ? Math.round((selectedProjectTesterRaised / selectedProject.totalIssues) * 100) : 0}% of project)
              </div>
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Staff Assigned
              </span>
              <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, color: "var(--text)" }}>
                {selectedProject?.membersCount || 0}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-dim)" }}>
                Active project members
              </div>
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Avg Turnaround
              </span>
              <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, color: "var(--info)" }}>
                {selectedProject?.avgResolutionFormatted || "N/A"}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-dim)" }}>
                Average time to fix/close
              </div>
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Resolution Rate
              </span>
              <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, color: "var(--ok)" }}>
                {selectedProject?.resolutionRatePercent || 0}%
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-dim)" }}>
                {(selectedProject?.resolvedIssues || 0) + (selectedProject?.closedIssues || 0)} issues resolved
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/*   PROJECT SPECIFIC: DEVELOPER RESOLUTION PERFORMANCE     */}
          {/* ======================================================== */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "18px 20px",
              boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Code2 className="h-4 w-4" style={{ color: "var(--info)" }} />
              <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                Developer Performance in {selectedProject?.name}
              </h3>
            </div>
            {selectedProject?.developers.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: "var(--text-faint)", fontSize: 12.5 }}>
                No developers are currently assigned to issues in this project.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {selectedProject?.developers.map((dev) => (
                  <div key={dev.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
                      <span style={{ fontWeight: 700, color: "var(--text)" }}>{dev.name}</span>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>
                          {dev.resolvedCount} of {dev.assignedCount} resolved
                        </span>
                        <span style={{ fontWeight: 700, color: "var(--ok)" }}>
                          {dev.resolutionRate}%
                        </span>
                        <span style={{ color: "var(--text-faint)", fontSize: 11.5 }}>
                          ({dev.avgResolutionFormatted} turnaround)
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 7, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${dev.resolutionRate}%`,
                          background: "linear-gradient(90deg, #2563eb, #10b981)",
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/*   PROJECT SPECIFIC: ISSUES RAISED BY TESTERS             */}
          {/* ======================================================== */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "20px 22px",
              boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                paddingBottom: 16,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: "var(--crit-soft)",
                    color: "var(--crit)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Bug className="h-4 w-4" />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                    Number of Issues Raised by Testers in {selectedProject?.name}
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
                    Bug reporting volume, severity distribution, and defect lifecycle by QA tester for this project.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 12,
                    fontSize: 11.5,
                    fontWeight: 800,
                    background: "var(--crit-soft)",
                    color: "var(--crit)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {selectedProjectTesterRaised} Issues Raised in {selectedProject?.key}
                </span>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 700,
                    background: "var(--surface-2)",
                    color: "var(--text-dim)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {selectedProject?.testers.length || 0} QA Reporters
                </span>
              </div>
            </div>

            {selectedProject?.testers.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
                No issues have been reported by testers in this project yet.
              </div>
            ) : (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                {selectedProject?.testers.map((tester) => (
                  <div
                    key={tester.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      padding: "14px 16px",
                      borderRadius: 10,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 800, color: "var(--text)", fontSize: 14 }}>
                          {tester.name}
                        </span>
                        <span style={{ color: "var(--text-faint)", fontSize: 11.5, fontFamily: "monospace" }}>
                          ({tester.email})
                        </span>
                      </div>

                      {/* Prominent Number of Issues Raised Badge */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 12px",
                            borderRadius: 20,
                            background: "linear-gradient(135deg, #e11d48, #f43f5e)",
                            color: "#ffffff",
                            fontSize: 12.5,
                            fontWeight: 800,
                            boxShadow: "0 2px 6px rgba(225, 29, 72, 0.25)",
                          }}
                        >
                          <Bug style={{ width: 13, height: 13 }} />
                          <span>{tester.totalRaised} Issues Raised by Tester</span>
                        </div>

                        {/* Severity badges */}
                        {tester.bySeverity.CRITICAL > 0 && (
                          <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: "var(--crit-soft)", color: "var(--crit)", border: "1px solid var(--border)" }}>
                            {tester.bySeverity.CRITICAL} Critical
                          </span>
                        )}
                        {tester.bySeverity.HIGH > 0 && (
                          <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: "var(--warn-soft)", color: "var(--warn)", border: "1px solid var(--border)" }}>
                            {tester.bySeverity.HIGH} High
                          </span>
                        )}
                        {tester.bySeverity.MEDIUM > 0 && (
                          <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: "var(--surface)", color: "var(--text-dim)", border: "1px solid var(--border)" }}>
                            {tester.bySeverity.MEDIUM} Med
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Visual Bar of Issues Raised relative to project issues */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, height: 8, background: "var(--surface)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${(tester.totalRaised / (selectedProject?.totalIssues || 1)) * 100}%`,
                            background: "linear-gradient(90deg, #f43f5e, #fb7185)",
                            borderRadius: 4,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-dim)" }}>
                        {selectedProject?.totalIssues ? ((tester.totalRaised / selectedProject.totalIssues) * 100).toFixed(0) : 0}% of project tickets
                      </span>
                    </div>

                    {/* Status lifecycle pills */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--text-dim)", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600 }}>Resolution Outcomes:</span>
                      <span style={{ color: "var(--crit)", fontWeight: 700 }}>{tester.byStatus.open} Open</span>
                      <span>•</span>
                      <span style={{ color: "var(--info)", fontWeight: 700 }}>{tester.byStatus.inProgress} In Progress</span>
                      <span>•</span>
                      <span style={{ color: "var(--ok)", fontWeight: 700 }}>{tester.byStatus.resolved + tester.byStatus.closed} Resolved / Fixed</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Team Workload Table */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                Team Staff Roster & Contributions
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
                Role, tickets assigned, tickets resolved, and tickets reported for this project.
              </p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                <thead>
                  <tr
                    style={{
                      background: "var(--surface-2)",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-faint)",
                      textTransform: "uppercase",
                    }}
                  >
                    <th style={{ padding: "10px 18px" }}>Member</th>
                    <th style={{ padding: "10px 14px" }}>Email</th>
                    <th style={{ padding: "10px 14px" }}>Role In Project</th>
                    <th style={{ padding: "10px 18px", textAlign: "right" }}>Assigned</th>
                    <th style={{ padding: "10px 18px", textAlign: "right" }}>Resolved</th>
                    <th style={{ padding: "10px 18px", textAlign: "right" }}>Raised</th>
                  </tr>
                </thead>
                <tbody>
                  {projectMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "var(--text-faint)" }}>
                        No members assigned to this project yet.
                      </td>
                    </tr>
                  ) : (
                    paginatedMembers.map((m, idx) => (
                      <tr
                        key={m.id}
                        style={{
                          borderBottom: idx === paginatedMembers.length - 1 ? "none" : "1px solid var(--border)",
                        }}
                      >
                        <td style={{ padding: "12px 18px", fontWeight: 600, color: "var(--text)" }}>{m.name}</td>
                        <td style={{ padding: "12px 14px", color: "var(--text-dim)", fontFamily: "monospace", fontSize: 11.5 }}>
                          {m.email}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              background: "var(--surface-2)",
                              color: "var(--text-dim)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            {m.roleInProject}
                          </span>
                        </td>
                        <td style={{ padding: "12px 18px", textAlign: "right", fontWeight: 600, color: "var(--text)" }}>
                          {m.assignedIssuesCount}
                        </td>
                        <td style={{ padding: "12px 18px", textAlign: "right", fontWeight: 700, color: "var(--ok)" }}>
                          {m.resolvedIssuesCount}
                        </td>
                        <td style={{ padding: "12px 18px", textAlign: "right", fontWeight: 700, color: "var(--info)" }}>
                          {m.raisedIssuesCount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {projectMembers.length > 0 && (
              <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
                <Pagination
                  currentPage={workloadPage}
                  totalItems={projectMembers.length}
                  pageSize={workloadPageSize}
                  onPageChange={setWorkloadPage}
                  pageSizeOptions={[5, 10, 20, 50]}
                  onPageSizeChange={(newSize) => {
                    setWorkloadPageSize(newSize);
                    setWorkloadPage(1);
                  }}
                  itemLabel="members"
                />
              </div>
            )}
          </div>

          {/* Recent Issues in Project */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "inset 0 1px 0 0 var(--border-specular), var(--shadow-xs)",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                Recent Issues in {selectedProject?.name}
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
                Latest tickets logged in this project with reporter and assignee attribution.
              </p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                <thead>
                  <tr
                    style={{
                      background: "var(--surface-2)",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-faint)",
                      textTransform: "uppercase",
                    }}
                  >
                    <th style={{ padding: "10px 18px" }}>Key</th>
                    <th style={{ padding: "10px 14px" }}>Title</th>
                    <th style={{ padding: "10px 14px" }}>Status</th>
                    <th style={{ padding: "10px 14px" }}>Severity</th>
                    <th style={{ padding: "10px 14px" }}>Reported By</th>
                    <th style={{ padding: "10px 18px" }}>Assigned To</th>
                  </tr>
                </thead>
                <tbody>
                  {projectRecentIssues.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "var(--text-faint)" }}>
                        No issues created in this project yet.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecentIssues.map((iss, idx) => (
                      <tr
                        key={iss.id}
                        style={{
                          borderBottom: idx === paginatedRecentIssues.length - 1 ? "none" : "1px solid var(--border)",
                        }}
                      >
                        <td style={{ padding: "12px 18px", fontWeight: 700, fontFamily: "monospace", color: "var(--info)" }}>
                          {iss.key}
                        </td>
                        <td style={{ padding: "12px 14px", fontWeight: 500, color: "var(--text)" }}>
                          {iss.title}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              background: "var(--surface-2)",
                              color: "var(--text)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            {iss.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              background:
                                iss.severity === "UI"
                                  ? "rgba(139, 92, 246, 0.12)"
                                  : iss.severity === "BACKEND"
                                  ? "rgba(16, 185, 129, 0.12)"
                                  : iss.severity === "AI"
                                  ? "rgba(236, 72, 153, 0.12)"
                                  : iss.severity === "CRITICAL"
                                  ? "var(--crit-soft)"
                                  : "var(--surface-2)",
                              color:
                                iss.severity === "UI"
                                  ? "#8B5CF6"
                                  : iss.severity === "BACKEND"
                                  ? "#10B981"
                                  : iss.severity === "AI"
                                  ? "#EC4899"
                                  : iss.severity === "CRITICAL"
                                  ? "var(--crit)"
                                  : "var(--text-dim)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            {iss.severity === "BACKEND" ? "Backend" : iss.severity}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", color: "var(--text-dim)", fontWeight: 500 }}>
                          {iss.reporterName}
                        </td>
                        <td style={{ padding: "12px 18px", color: "var(--text)" }}>
                          {iss.assigneeName || (
                            <span style={{ color: "var(--text-faint)", fontStyle: "italic" }}>Unassigned</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {projectRecentIssues.length > 0 && (
              <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
                <Pagination
                  currentPage={recentIssuesPage}
                  totalItems={projectRecentIssues.length}
                  pageSize={recentIssuesPageSize}
                  onPageChange={setRecentIssuesPage}
                  pageSizeOptions={[5, 10, 20, 50]}
                  onPageSizeChange={(newSize) => {
                    setRecentIssuesPageSize(newSize);
                    setRecentIssuesPage(1);
                  }}
                  itemLabel="recent issues"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
