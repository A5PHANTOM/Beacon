"use client";

import React, { useState, useTransition } from "react";
import type { AdminTimesheetReportData, TaskSlotDto } from "@/lib/timesheet-types";
import { getAdminTimesheetReportsAction } from "@/app/(dashboard)/admin/timesheets/actions";
import { formatMinutes, TIMESHEET_CATEGORIES } from "@/lib/timesheet-constants";
import { CategoryBadge } from "./category-badge";

export function AdminTimesheetReports({
  initialData,
}: {
  initialData: AdminTimesheetReportData;
}) {
  const [data, setData] = useState<AdminTimesheetReportData>(initialData);
  const [preset, setPreset] = useState<string>(initialData.filterRange.preset);
  const [startDate, setStartDate] = useState<string>(initialData.filterRange.startDate);
  const [endDate, setEndDate] = useState<string>(initialData.filterRange.endDate);
  const [selectedMember, setSelectedMember] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedMemberModal, setSelectedMemberModal] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleApplyFilter = (overridePreset?: string) => {
    const activePreset = overridePreset || preset;
    startTransition(async () => {
      const res = await getAdminTimesheetReportsAction({
        preset: activePreset,
        startDate,
        endDate,
        memberId: selectedMember,
        category: selectedCategory,
        projectId: selectedProject,
      });

      if (res.success && res.data) {
        setData(res.data);
      }
    });
  };

  const handleExportCSV = () => {
    const headers = [
      "Date",
      "Member Name",
      "Member Email",
      "Project",
      "Category",
      "Task Title",
      "Duration (Hours)",
      "Duration (Minutes)",
      "Start Time",
      "End Time",
      "Description",
    ];

    const rows = data.recentEntries.map((e) => [
      e.date,
      `"${e.userName.replace(/"/g, '""')}"`,
      `"${e.userEmail.replace(/"/g, '""')}"`,
      `"${(e.projectKey || e.projectName || "General").replace(/"/g, '""')}"`,
      `"${e.category}"`,
      `"${e.taskTitle.replace(/"/g, '""')}"`,
      (e.durationMinutes / 60).toFixed(2),
      e.durationMinutes,
      e.startTime || "",
      e.endTime || "",
      `"${(e.description || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `beacon_timesheets_${data.filterRange.startDate}_to_${data.filterRange.endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter entries for client search
  const filteredEntries = data.recentEntries.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.taskTitle.toLowerCase().includes(q) ||
      e.userName.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      (e.projectName && e.projectName.toLowerCase().includes(q)) ||
      (e.projectKey && e.projectKey.toLowerCase().includes(q)) ||
      (e.description && e.description.toLowerCase().includes(q))
    );
  });

  const memberModalSlots = selectedMemberModal
    ? data.recentEntries.filter((e) => e.userId === selectedMemberModal)
    : [];

  const selectedMemberObj = selectedMemberModal
    ? data.allMembers.find((m) => m.id === selectedMemberModal)
    : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-float-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[var(--text)] tracking-tight">
            Timesheet Reports & Attendance Analytics
          </h1>
          <p className="text-xs text-[var(--text-dim)] mt-0.5">
            Admin oversight on member hours logged, attendance check-ins, and 8-category task allocation
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="btn-primary rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] px-4 py-2 text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Filter Control Bar */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[var(--text-faint)] mr-1">Period:</span>
          {[
            { label: "Today", value: "today" },
            { label: "This Week", value: "this_week" },
            { label: "Last Week", value: "last_week" },
            { label: "This Month", value: "this_month" },
            { label: "Last Month", value: "last_month" },
            { label: "Custom", value: "custom" },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setPreset(item.value);
                if (item.value !== "custom") {
                  handleApplyFilter(item.value);
                }
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                preset === item.value
                  ? "bg-[var(--accent)] text-white shadow-xs"
                  : "bg-[var(--surface-2)] text-[var(--text-dim)] hover:bg-[var(--surface-hover)] border border-[var(--border)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--border)]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--text-dim)]">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--text-dim)]">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
              />
            </div>
            <button
              type="button"
              onClick={() => handleApplyFilter()}
              className="rounded-lg bg-[var(--accent)] text-white px-3 py-1.5 text-xs font-bold hover:opacity-90 transition cursor-pointer"
            >
              Apply Range
            </button>
          </div>
        )}

        {/* Dropdowns Row: Member, Category, Project */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--border)]">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-1">
              Member Filter
            </label>
            <select
              value={selectedMember}
              onChange={(e) => {
                setSelectedMember(e.target.value);
                startTransition(async () => {
                  const res = await getAdminTimesheetReportsAction({
                    preset,
                    startDate,
                    endDate,
                    memberId: e.target.value,
                    category: selectedCategory,
                    projectId: selectedProject,
                  });
                  if (res.success && res.data) setData(res.data);
                });
              }}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
            >
              <option value="ALL">All Team Members ({data.allMembers.length})</option>
              {data.allMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-1">
              Category Filter
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                startTransition(async () => {
                  const res = await getAdminTimesheetReportsAction({
                    preset,
                    startDate,
                    endDate,
                    memberId: selectedMember,
                    category: e.target.value,
                    projectId: selectedProject,
                  });
                  if (res.success && res.data) setData(res.data);
                });
              }}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
            >
              <option value="ALL">All 8 Task Categories</option>
              {TIMESHEET_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-1">
              Project Filter
            </label>
            <select
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value);
                startTransition(async () => {
                  const res = await getAdminTimesheetReportsAction({
                    preset,
                    startDate,
                    endDate,
                    memberId: selectedMember,
                    category: selectedCategory,
                    projectId: e.target.value,
                  });
                  if (res.success && res.data) setData(res.data);
                });
              }}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
            >
              <option value="ALL">All Projects ({data.allProjects.length})</option>
              {data.allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.key}] {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
            Total Team Hours
          </div>
          <div className="mono text-2xl font-black text-[var(--accent)] mt-1">
            {data.metrics.totalHoursLogged} hrs
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
            Across {data.metrics.totalTaskSlots} logged slots
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
            Active Members
          </div>
          <div className="mono text-2xl font-black text-[var(--text)] mt-1">
            {data.metrics.activeMembersCount} / {data.allMembers.length}
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
            Avg {data.metrics.avgDailyHoursPerMember} hrs / member
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
            Check-ins Recorded
          </div>
          <div className="mono text-2xl font-black text-[var(--ok)] mt-1">
            {data.metrics.totalCheckInsRecorded}
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
            Daily clock-in records
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
            On-Time Arrival
          </div>
          <div className="mono text-2xl font-black text-[var(--info)] mt-1">
            {data.metrics.onTimeCheckInPercentage}%
          </div>
          <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
            Checked in before 10:00 AM
          </div>
        </div>
      </div>

      {/* 8-Category Allocation Section */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">
              Work Breakdown by Category
            </h3>
            <p className="text-xs text-[var(--text-dim)]">
              Distribution of hours logged across all 8 standard categories
            </p>
          </div>
          <span className="mono text-xs font-bold text-[var(--accent)]">
            {data.metrics.totalHoursLogged} Total Hours
          </span>
        </div>

        {/* Stacked Progress Bar */}
        <div className="w-full h-3 rounded-full bg-[var(--surface-2)] overflow-hidden flex border border-[var(--border)]">
          {data.categoryBreakdown.map((cat) => {
            if (cat.percentage <= 0) return null;
            return (
              <div
                key={cat.category}
                style={{
                  width: `${cat.percentage}%`,
                  backgroundColor: cat.color,
                }}
                className="h-full transition-all duration-300"
                title={`${cat.label}: ${cat.totalHours}h (${cat.percentage}%)`}
              />
            );
          })}
        </div>

        {/* Category Detail Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.categoryBreakdown.map((cat) => (
            <div
              key={cat.category}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3 space-y-1"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-xs font-bold text-[var(--text)] truncate">
                  {cat.label}
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="mono text-sm font-extrabold text-[var(--text)]">
                  {cat.totalHours} hrs
                </span>
                <span className="mono text-xs font-bold text-[var(--accent)]">
                  {cat.percentage}%
                </span>
              </div>
              <div className="text-[10px] text-[var(--text-faint)] font-medium">
                {cat.slotsCount} task slot{cat.slotsCount === 1 ? "" : "s"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Member Attendance & Hours Summary Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-[var(--text)]">
            Member Workload & Attendance Summary
          </h3>
          <p className="text-xs text-[var(--text-dim)]">
            Individual hours logged, attendance check-ins, and task category allocations
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-2)] border-b border-[var(--border)] text-[var(--text-faint)] font-bold uppercase tracking-wider text-[10.5px]">
              <tr>
                <th className="py-2.5 px-4">Member</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Days In</th>
                <th className="py-2.5 px-3">Avg Check-in</th>
                <th className="py-2.5 px-3">Total Logged</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[var(--text)]">
              {data.memberSummaries.map((m) => (
                <tr
                  key={m.userId}
                  className="hover:bg-[var(--surface-hover)]/60 transition"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-bold flex items-center justify-center shrink-0">
                        {m.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-[var(--text)]">{m.name}</div>
                        <div className="mono text-[10.5px] text-[var(--text-faint)]">
                          {m.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="rounded bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-dim)] border border-[var(--border)]">
                      {m.role}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold">
                    {m.daysCheckedIn} days
                  </td>
                  <td className="py-3 px-3 mono text-[11px] font-medium text-[var(--text-dim)]">
                    {m.avgCheckInTime || "—"}
                  </td>
                  <td className="py-3 px-3">
                    <span className="mono font-bold text-xs text-[var(--accent)]">
                      {m.totalHoursLogged} hrs
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedMemberModal(m.userId)}
                      className="rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-hover)] border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)] transition cursor-pointer"
                    >
                      View Slots ({data.recentEntries.filter((e) => e.userId === m.userId).length})
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Task Slots Log */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">
              Detailed Task Slots Log ({filteredEntries.length})
            </h3>
            <p className="text-xs text-[var(--text-dim)]">
              All task activities recorded during this period
            </p>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search by task, member, project…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-hidden focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-2)] border-b border-[var(--border)] text-[var(--text-faint)] font-bold uppercase tracking-wider text-[10.5px]">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-3">Member</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-4">Task Done</th>
                <th className="py-2.5 px-3">Project</th>
                <th className="py-2.5 px-3 text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[var(--text)]">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-faint)]">
                    No task slots matching current filters
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-[var(--surface-hover)]/60 transition">
                    <td className="py-3 px-4 mono text-[11px] text-[var(--text-dim)] whitespace-nowrap">
                      {e.date}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-medium text-[var(--text)]">
                      {e.userName}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <CategoryBadge category={e.category} size="sm" />
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-semibold text-[var(--text)] truncate" title={e.taskTitle}>
                        {e.taskTitle}
                      </div>
                      {e.description && (
                        <div className="text-[11px] text-[var(--text-dim)] truncate">
                          {e.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap mono text-[11px] font-semibold text-[var(--text-dim)]">
                      {e.projectKey ? `[${e.projectKey}]` : "General"}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap mono font-bold text-[var(--accent)]">
                      {formatMinutes(e.durationMinutes)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Member Details Modal */}
      {selectedMemberModal && selectedMemberObj && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedMemberModal(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">
                  {selectedMemberObj.name}&rsquo;s Task Slots
                </h3>
                <p className="text-xs text-[var(--text-dim)]">
                  {selectedMemberObj.email} • {memberModalSlots.length} slot{memberModalSlots.length === 1 ? "" : "s"} logged in period
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMemberModal(null)}
                className="p-1 rounded-lg text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
              {memberModalSlots.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-faint)]">
                  No slots logged for this period
                </div>
              ) : (
                memberModalSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CategoryBadge category={slot.category} size="sm" />
                        <span className="mono text-[10.5px] text-[var(--text-faint)]">
                          {slot.date}
                        </span>
                      </div>
                      <span className="mono text-xs font-bold text-[var(--accent)]">
                        {formatMinutes(slot.durationMinutes)}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[var(--text)]">
                      {slot.taskTitle}
                    </div>
                    {slot.description && (
                      <div className="text-xs text-[var(--text-dim)]">
                        {slot.description}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-[var(--border)] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMemberModal(null)}
                className="rounded-lg bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
