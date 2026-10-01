"use client";

import React from "react";
import type { MonthDayCell } from "@/lib/timesheet-types";
import { formatMinutes } from "@/lib/timesheet-constants";

export function MonthView({
  monthDays = [],
  monthTotalMinutes = 0,
  onSelectDate,
  onAddSlot,
}: {
  monthDays?: MonthDayCell[];
  monthTotalMinutes?: number;
  onSelectDate: (date: string) => void;
  onAddSlot: (date: string) => void;
}) {
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-4">
      {/* Simple Month Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 shadow-xs">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Month Total
            </span>
            <div className="mono text-base font-black text-[var(--accent)]">
              {formatMinutes(monthTotalMinutes)}
            </div>
          </div>

          <div className="h-6 w-[1px] bg-[var(--border)]" />

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Logged Days
            </span>
            <div className="mono text-sm font-bold text-[var(--text)]">
              {monthDays.filter((d) => d.isCurrentMonth && d.totalMinutes > 0).length} days
            </div>
          </div>
        </div>

        <div className="text-xs text-[var(--text-dim)] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--ok)] shrink-0" />
          <span>Task slots can only be logged for <b>Today</b>.</span>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-xs">
        {/* Day Name Headers */}
        <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-2)]">
          {dayNames.map((name) => (
            <div
              key={name}
              className="py-2.5 text-center text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Day Cells Grid */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-[var(--border)]">
          {monthDays.map((cell) => {
            return (
              <div
                key={cell.date}
                onClick={() => onSelectDate(cell.date)}
                className={`min-h-[96px] p-2 flex flex-col justify-between transition-colors cursor-pointer group ${
                  !cell.isCurrentMonth
                    ? "bg-[var(--surface-2)]/30 text-[var(--text-faint)] opacity-50"
                    : cell.isToday
                    ? "bg-[var(--accent-soft)]/50 font-bold"
                    : "bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {/* Cell Top Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      cell.isToday
                        ? "bg-[var(--accent)] text-white shadow-xs"
                        : cell.isCurrentMonth
                        ? "text-[var(--text)] group-hover:text-[var(--accent)]"
                        : "text-[var(--text-faint)]"
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {cell.hasCheckIn && (
                    <span
                      className="inline-flex items-center gap-1 rounded bg-[var(--ok-soft)] px-1.5 py-0.5 text-[9.5px] font-bold text-[var(--ok)]"
                      title={`Check-in: ${cell.checkInTimeFormatted || "Present"}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)]" />
                      <span className="hidden sm:inline">
                        {cell.checkInTimeFormatted || "In"}
                      </span>
                    </span>
                  )}
                </div>

                {/* Center / Body: Logged Hours and Category Pills */}
                <div className="my-1 space-y-1">
                  {cell.totalMinutes > 0 ? (
                    <div className="flex items-center justify-between">
                      <span className="mono text-[11px] font-bold text-[var(--accent)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
                        {formatMinutes(cell.totalMinutes)}
                      </span>
                      <span className="text-[10px] text-[var(--text-faint)] font-medium">
                        {cell.entryCount} task{cell.entryCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  ) : null}

                  {/* Category dots */}
                  <div className="flex flex-wrap gap-1">
                    {cell.categoryBadges.map((badge) => (
                      <span
                        key={badge.category}
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: badge.color }}
                        title={`${badge.category}: ${badge.count}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Bottom: ONLY allow adding if this cell is today! */}
                {cell.isToday ? (
                  <div className="flex items-center justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddSlot(cell.date);
                      }}
                      className="rounded-lg bg-[var(--accent)] text-white px-2 py-0.5 text-[10.5px] font-bold shadow-xs hover:opacity-95 transition"
                    >
                      ＋ Log
                    </button>
                  </div>
                ) : (
                  <div className="h-4" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
