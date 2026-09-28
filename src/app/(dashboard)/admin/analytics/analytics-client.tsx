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
  Calendar,
  ExternalLink,
} from "lucide-react";
import type {
  SystemAnalyticsData,
  ProjectAnalyticsData,
} from "./actions";
import { getSystemAnalyticsAction } from "./actions";

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
        ? "Generating project PDF report with blue gradient template..."
        : "Generating system executive PDF report with blue gradient template..."
    );

    try {
      const url = projectId
        ? `/api/admin/analytics/pdf?projectId=${encodeURIComponent(projectId)}`
        : `/api/admin/analytics/pdf`;

      // Trigger download via temporary link
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
      setTimeout(() => setDownloadingPdf(null), 1200);
    }
  };

  const selectedProject =
    data.projects.find((p) => p.id === selectedProjectId) || data.projects[0];

  const filteredProjects = data.projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-16 bg-slate-50 text-slate-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-xl shadow-blue-500/10 text-xs font-semibold text-slate-800 transition-all animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="h-4 w-4 text-blue-600 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Hero Banner with Light Mode Blue Gradient */}
      <div className="relative overflow-hidden border-b border-blue-100 bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-600 px-6 py-9 text-white shadow-md">
        {/* Subtle decorative glow shapes */}
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-sky-400/20 blur-2xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold tracking-wider uppercase text-blue-100 backdrop-blur-md border border-white/20">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-200" />
                  Beacon Admin Center
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-1 text-[11px] font-bold text-emerald-200 border border-emerald-300/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Analytics & Performance Intelligence
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-blue-100/90 max-w-2xl">
                Comprehensive system diagnostics, individual project velocity, issue turnaround
                times, and branded PDF audit reports.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-white/20 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadPdf()}
                disabled={downloadingPdf === "system"}
                className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-blue-800 shadow-lg shadow-black/10 hover:bg-blue-50 transition transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-blue-700" />
                <span>
                  {downloadingPdf === "system" ? "Generating PDF..." : "Export System PDF"}
                </span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-7 flex items-center gap-2 border-t border-white/15 pt-4">
            <button
              type="button"
              onClick={() => setActiveTab("system")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "system"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>System Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("project")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "project"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <FolderKanban className="h-3.5 w-3.5" />
              <span>Project Deep-Dive</span>
              <span className="rounded-full bg-blue-500/30 px-2 py-0.5 text-[10px] text-white">
                {data.projects.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-8">
        {activeTab === "system" ? (
          /* ========================================================== */
          /*                     SYSTEM OVERVIEW TAB                    */
          /* ========================================================== */
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* 4 Main KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: Users */}
              <div className="group relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-5 shadow-xs transition hover:shadow-md hover:border-blue-300">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Total Users
                  </span>
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                    {data.overview.totalUsers}
                  </span>
                  <span className="text-xs font-medium text-slate-500">accounts</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                  <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                    {data.overview.adminCount} Admins
                  </span>
                  <span>•</span>
                  <span>{data.overview.memberCount} Members</span>
                </div>
              </div>

              {/* Card 2: Active Projects */}
              <div className="group relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-5 shadow-xs transition hover:shadow-md hover:border-blue-300">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Active Projects
                  </span>
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <FolderKanban className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                    {data.overview.activeProjects}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    of {data.overview.totalProjects} total
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                  <span className="font-semibold text-indigo-700">100% Online</span>
                  <span>•</span>
                  <span>Tracked in DB</span>
                </div>
              </div>

              {/* Card 3: Issue Volume */}
              <div className="group relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-5 shadow-xs transition hover:shadow-md hover:border-blue-300">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Total Issues
                  </span>
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                    <Layers className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                    {data.overview.totalIssues}
                  </span>
                  <span className="text-xs font-medium text-slate-500">across system</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                  <span className="font-semibold text-rose-600">
                    {data.overview.openIssues} Open
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-blue-600">
                    {data.overview.inProgressIssues} Active
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-emerald-600">
                    {data.overview.resolvedIssues + data.overview.closedIssues} Done
                  </span>
                </div>
              </div>

              {/* Card 4: Avg Resolution Time */}
              <div className="group relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-5 shadow-xs transition hover:shadow-md hover:border-blue-300">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Avg Resolution Time
                  </span>
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                    {data.overview.avgResolutionFormatted}
                  </span>
                  <span className="text-xs font-medium text-slate-500">turnaround</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                  <span className="font-semibold text-emerald-700">
                    {data.overview.resolutionRatePercent}% Resolved Rate
                  </span>
                  <span className="text-slate-400">Total Lifecycle</span>
                </div>
              </div>
            </div>

            {/* Distribution Charts Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Status Distribution */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Status Distribution</h3>
                  <span className="text-xs font-semibold text-slate-500">
                    {data.overview.totalIssues} total
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {data.statusDistribution.map((item) => (
                    <div key={item.status} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{item.count}</span>
                          <span className="text-slate-400">({item.percentage}%)</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Severity Breakdown */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Severity Breakdown</h3>
                  <span className="text-xs font-semibold text-slate-500">Risk Profile</span>
                </div>
                <div className="mt-4 space-y-3">
                  {data.severityDistribution.map((item) => (
                    <div key={item.severity} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className="font-bold"
                          style={{ color: item.color }}
                        >
                          {item.severity}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{item.count}</span>
                          <span className="text-slate-400">({item.percentage}%)</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority Breakdown */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Priority Breakdown</h3>
                  <span className="text-xs font-semibold text-slate-500">Queue Urgency</span>
                </div>
                <div className="mt-4 space-y-3">
                  {data.priorityDistribution.map((item) => (
                    <div key={item.priority} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className="font-bold"
                          style={{ color: item.color }}
                        >
                          {item.priority}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{item.count}</span>
                          <span className="text-slate-400">({item.percentage}%)</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Project Performance Comparison Matrix */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Project Performance & Analytics Matrix
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Compare velocity, issue counts, and download individual PDF audits per project.
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden transition"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Project</th>
                      <th className="py-3 px-4">Team</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      <th className="py-3 px-4 text-right">Open</th>
                      <th className="py-3 px-4 text-right">Active</th>
                      <th className="py-3 px-4 text-right">Resolved</th>
                      <th className="py-3 px-4 text-right">Avg Resolution</th>
                      <th className="py-3 px-4">Resolution Rate</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProjects.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          No matching projects found
                        </td>
                      </tr>
                    ) : (
                      filteredProjects.map((p) => (
                        <tr
                          key={p.id}
                          className="hover:bg-blue-50/40 transition group cursor-pointer"
                          onClick={() => {
                            setSelectedProjectId(p.id);
                            setActiveTab("project");
                          }}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 font-mono">
                                {p.key}
                              </span>
                              <span className="font-semibold text-slate-900 group-hover:text-blue-700 transition">
                                {p.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {p.membersCount} members
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                            {p.totalIssues}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-rose-600">
                            {p.openIssues}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-blue-600">
                            {p.inProgressIssues}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-emerald-600">
                            {p.resolvedIssues + p.closedIssues}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                            {p.avgResolutionFormatted}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-blue-600"
                                  style={{ width: `${p.resolutionRatePercent}%` }}
                                />
                              </div>
                              <span className="font-semibold text-slate-700">
                                {p.resolutionRatePercent}%
                              </span>
                            </div>
                          </td>
                          <td
                            className="py-3.5 px-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                title="Download individual project PDF"
                                onClick={() => handleDownloadPdf(p.id)}
                                disabled={downloadingPdf === p.id}
                                className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                              >
                                <Download className="h-3 w-3" />
                                <span>PDF</span>
                              </button>
                              <Link
                                href={`/projects/${p.id}`}
                                className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                                title="Open project board"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================== */
          /*                  PROJECT DEEP-DIVE TAB                     */
          /* ========================================================== */
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Project Picker Header */}
            <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-600 text-white font-extrabold text-sm shadow-md shadow-blue-500/20 font-mono">
                    {selectedProject?.key || "PRJ"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-extrabold text-slate-900">
                        {selectedProject?.name}
                      </h2>
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-mono font-bold text-blue-700 border border-blue-200">
                        {selectedProject?.key}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedProject?.description || "No project description provided."}
                    </p>
                  </div>
                </div>

                {/* Project Selector & Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden transition"
                  >
                    {data.projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name} ({proj.key})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(selectedProject?.id)}
                    disabled={downloadingPdf === selectedProject?.id}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition cursor-pointer disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>
                      {downloadingPdf === selectedProject?.id
                        ? "Generating PDF..."
                        : `Download ${selectedProject?.key} PDF`}
                    </span>
                  </button>

                  <Link
                    href={`/projects/${selectedProject?.id}`}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    <span>Open Board</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Project Specific KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Project Total Issues
                </span>
                <div className="mt-2 text-3xl font-extrabold text-slate-900">
                  {selectedProject?.totalIssues || 0}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {selectedProject?.openIssues || 0} Open • {selectedProject?.inProgressIssues || 0} In
                  Progress
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Assigned Team
                </span>
                <div className="mt-2 text-3xl font-extrabold text-slate-900">
                  {selectedProject?.membersCount || 0}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Project staff & contributors
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Avg Turnaround
                </span>
                <div className="mt-2 text-3xl font-extrabold text-blue-700">
                  {selectedProject?.avgResolutionFormatted || "N/A"}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Average time to fix/close
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Resolution Rate
                </span>
                <div className="mt-2 text-3xl font-extrabold text-emerald-600">
                  {selectedProject?.resolutionRatePercent || 0}%
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {(selectedProject?.resolvedIssues || 0) + (selectedProject?.closedIssues || 0)} issues
                  completed
                </div>
              </div>
            </div>

            {/* Team Members Workload Table */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Team Member Workload & Contributions
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Individual issue distribution and resolved turnover for this project.
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  {selectedProject?.members.length} Members
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Role In Project</th>
                      <th className="py-3 px-4 text-right">Assigned Issues</th>
                      <th className="py-3 px-4 text-right">Resolved Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedProject?.members.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No team members assigned to this project
                        </td>
                      </tr>
                    ) : (
                      selectedProject?.members.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {m.name}
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                            {m.email}
                          </td>
                          <td className="py-3 px-4">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                              {m.roleInProject}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-800">
                            {m.assignedIssuesCount}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600">
                            {m.resolvedIssuesCount}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Issues List */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Recent Issues Recorded
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Latest activity and tickets in {selectedProject?.name}.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Key</th>
                      <th className="py-3 px-4">Title</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Assignee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedProject?.recentIssues.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No issues created yet in this project
                        </td>
                      </tr>
                    ) : (
                      selectedProject?.recentIssues.map((iss) => (
                        <tr key={iss.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-mono font-bold text-blue-700">
                            {iss.key}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900">
                            {iss.title}
                          </td>
                          <td className="py-3 px-4">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                              {iss.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                iss.severity === "CRITICAL"
                                  ? "bg-rose-50 text-rose-700"
                                  : iss.severity === "HIGH"
                                  ? "bg-orange-50 text-orange-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {iss.severity}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-600">
                            {iss.priority}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {iss.assigneeName || "Unassigned"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
