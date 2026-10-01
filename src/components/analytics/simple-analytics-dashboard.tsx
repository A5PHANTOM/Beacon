"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { MemberProgressData } from "@/app/(dashboard)/analytics/actions";
import { formatMinutes } from "@/lib/timesheet-constants";
import { CategoryBadge } from "@/components/timesheets/category-badge";

export function SimpleAnalyticsDashboard({
  data,
}: {
  data: MemberProgressData;
}) {
  const { user, targets, attendance, categoryBreakdown, projectBreakdown, weeklyVelocity, recentActivity, teamPulse } = data;

  const maxWeeklyHours = Math.max(8, ...weeklyVelocity.map((v) => v.hours));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-float-in">
      {/* Top Welcome & Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black text-[var(--text)] tracking-tight">
              Progress & Activity Dashboard
            </h1>
            <span className="rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 px-2.5 py-0.5 text-xs font-bold">
              {user.role}
            </span>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-0.5">
            Track your target hours, daily velocity, and activity allocation across projects
          </p>
        </div>

        <Link
          href="/timesheets"
          className="btn-primary rounded-xl bg-[var(--accent)] text-white px-4 py-2 text-xs font-bold shadow-sm hover:opacity-95 transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>Open Timesheet Calendar</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Target Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Today's Target */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Today&rsquo;s Progress
            </span>
            <span className="mono text-xs font-bold text-[var(--accent)]">
              {targets.todayPercent}%
            </span>
          </div>

          <div>
            <div className="mono text-2xl font-black text-[var(--text)]">
              {formatMinutes(targets.todayMinutes)}
            </div>
            <div className="text-xs text-[var(--text-dim)] mt-0.5">
              Goal: 8h 00m ({formatMinutes(Math.max(0, targets.todayTargetMinutes - targets.todayMinutes))} remaining)
            </div>
          </div>

          <div className="w-full bg-[var(--surface-2)] rounded-full h-2.5 border border-[var(--border)] overflow-hidden">
            <div
              className="bg-[var(--accent)] h-full rounded-full transition-all duration-500"
              style={{ width: `${targets.todayPercent}%` }}
            />
          </div>
        </div>

        {/* This Week's Target */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              This Week&rsquo;s Goal
            </span>
            <span className="mono text-xs font-bold text-[var(--ok)]">
              {targets.weekPercent}%
            </span>
          </div>

          <div>
            <div className="mono text-2xl font-black text-[var(--text)]">
              {formatMinutes(targets.weekMinutes)}
            </div>
            <div className="text-xs text-[var(--text-dim)] mt-0.5">
              Target: 40h 00m ({formatMinutes(Math.max(0, targets.weekTargetMinutes - targets.weekMinutes))} left)
            </div>
          </div>

          <div className="w-full bg-[var(--surface-2)] rounded-full h-2.5 border border-[var(--border)] overflow-hidden">
            <div
              className="bg-[var(--ok)] h-full rounded-full transition-all duration-500"
              style={{ width: `${targets.weekPercent}%` }}
            />
          </div>
        </div>

        {/* This Month's Target */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Monthly Attendance
            </span>
            <span className="mono text-xs font-bold text-[var(--info)]">
              {attendance.attendancePercent}%
            </span>
          </div>

          <div>
            <div className="mono text-2xl font-black text-[var(--text)]">
              {attendance.checkedInDaysThisMonth} Days In
            </div>
            <div className="text-xs text-[var(--text-dim)] mt-0.5">
              Logged {formatMinutes(targets.monthMinutes)} across {attendance.totalMonthWorkingDays} working days
            </div>
          </div>

          <div className="w-full bg-[var(--surface-2)] rounded-full h-2.5 border border-[var(--border)] overflow-hidden">
            <div
              className="bg-[var(--info)] h-full rounded-full transition-all duration-500"
              style={{ width: `${attendance.attendancePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Velocity and Category Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Velocity Bar Chart */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">
                Daily Work Velocity (This Week)
              </h3>
              <p className="text-xs text-[var(--text-dim)]">
                Hours logged per day from Monday to Sunday
              </p>
            </div>
            <span className="mono text-xs font-bold text-[var(--accent)]">
              {formatMinutes(targets.weekMinutes)} Total
            </span>
          </div>

          {/* Bar Chart Container */}
          <div className="h-48 pt-6 pb-2 flex items-end justify-between gap-3 border-b border-[var(--border)]">
            {weeklyVelocity.map((day) => {
              const heightPercent = maxWeeklyHours > 0 ? Math.min(100, Math.round((day.hours / maxWeeklyHours) * 100)) : 0;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <span className="mono text-[10.5px] font-bold text-[var(--text)] opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                    {day.hours > 0 ? `${day.hours}h` : ""}
                  </span>
                  <div className="w-full max-w-[36px] bg-[var(--surface-2)] rounded-t-lg overflow-hidden flex items-end h-full">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        day.isToday
                          ? "bg-[var(--accent)]"
                          : day.hours > 0
                          ? "bg-[var(--accent-soft-2)] group-hover:bg-[var(--accent)]"
                          : "bg-transparent"
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-bold uppercase mt-2 ${
                      day.isToday ? "text-[var(--accent)]" : "text-[var(--text-dim)]"
                    }`}
                  >
                    {day.dayName}
                  </span>
                  <span className="mono text-[9.5px] text-[var(--text-faint)]">
                    {day.dayNumber}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--text-dim)] pt-1">
            <span>Standard target: 8.0h / day</span>
            <span className="font-semibold text-[var(--accent)]">
              Avg: {(targets.weekMinutes / 60 / 5).toFixed(1)}h / workday
            </span>
          </div>
        </div>

        {/* Category Breakdown (8 Categories) */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">
                Work Allocation by Category
              </h3>
              <p className="text-xs text-[var(--text-dim)]">
                Where your hours were invested this month
              </p>
            </div>
            <span className="mono text-xs font-bold text-[var(--accent)]">
              8 Standard Categories
            </span>
          </div>

          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
            {categoryBreakdown.map((cat) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-bold text-[var(--text)]">{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="mono font-bold text-[var(--text)]">{cat.totalHours} hrs</span>
                    <span className="mono text-[11px] text-[var(--text-faint)]">({cat.percentage}%)</span>
                  </div>
                </div>

                <div className="w-full bg-[var(--surface-2)] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Projects and Team Pulse Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Project Distribution */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-[var(--text)]">
            Project Contributions
          </h3>
          <div className="space-y-2">
            {projectBreakdown.length === 0 ? (
              <div className="text-xs text-[var(--text-faint)] py-4 text-center">
                No project time logged this month
              </div>
            ) : (
              projectBreakdown.map((p) => (
                <div
                  key={p.projectKey}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text)] truncate">
                      {p.projectName}
                    </span>
                    <span className="mono text-xs font-bold text-[var(--accent)]">
                      {p.totalHours}h
                    </span>
                  </div>
                  <div className="w-full bg-[var(--surface)] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[var(--accent)] h-full rounded-full"
                      style={{ width: `${p.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Team Momentum Pulse */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-[var(--text)]">
            Team Pulse (This Week)
          </h3>
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border)]">
              <span className="text-xs font-medium text-[var(--text-dim)]">Active Teammates</span>
              <span className="mono text-xs font-bold text-[var(--text)]">
                {teamPulse.activeMembersThisWeek} members
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border)]">
              <span className="text-xs font-medium text-[var(--text-dim)]">Total Team Hours</span>
              <span className="mono text-xs font-bold text-[var(--accent)]">
                {teamPulse.totalTeamHoursThisWeek} hrs
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border)]">
              <span className="text-xs font-medium text-[var(--text-dim)]">Top Activity</span>
              <span className="rounded bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-bold text-[var(--accent)]">
                {teamPulse.topCategoryThisWeek}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Tasks Completed */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-[var(--text)]">
            Recent Work Logged
          </h3>
          <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
            {recentActivity.length === 0 ? (
              <div className="text-xs text-[var(--text-faint)] py-4 text-center">
                No recent activity logged
              </div>
            ) : (
              recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-2.5 space-y-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <CategoryBadge category={item.category} size="sm" />
                    <span className="mono text-[10px] font-bold text-[var(--accent)]">
                      {formatMinutes(item.durationMinutes)}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-[var(--text)] truncate" title={item.taskTitle}>
                    {item.taskTitle}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
