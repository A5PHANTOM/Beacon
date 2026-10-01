"use client";

import React from "react";
import type { WeekDaySummary, TaskSlotDto } from "@/lib/timesheet-types";
import { formatMinutes, formatTimeAmPm } from "@/lib/timesheet-constants";
import { CategoryBadge } from "./category-badge";

export function WeekView({
  weekDays = [],
  weekTotalMinutes = 0,
  onAddSlot,
  onEditSlot,
  onDeleteSlot,
  onSelectDate,
}: {
  weekDays?: WeekDaySummary[];
  weekTotalMinutes?: number;
  onAddSlot: (date: string) => void;
  onEditSlot: (slot: TaskSlotDto) => void;
  onDeleteSlot: (slotId: string) => void;
  onSelectDate: (date: string) => void;
}) {
  const avgDailyMinutes =
    weekDays.length > 0 ? Math.round(weekTotalMinutes / weekDays.length) : 0;

  return (
    <div className="space-y-4">
      {/* Simple Week Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 shadow-xs">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Week Total
            </span>
            <div className="mono text-base font-black text-[var(--accent)]">
              {formatMinutes(weekTotalMinutes)}
            </div>
          </div>

          <div className="h-6 w-[1px] bg-[var(--border)]" />

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Daily Average
            </span>
            <div className="mono text-sm font-bold text-[var(--text)]">
              {formatMinutes(avgDailyMinutes)} / day
            </div>
          </div>
        </div>

        <div className="text-xs text-[var(--text-dim)] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--ok)] shrink-0" />
          <span>Task slots can only be logged for <b>Today</b>.</span>
        </div>
      </div>

      {/* 7 Columns for Monday - Sunday */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {weekDays.map((day) => {
          return (
            <div
              key={day.date}
              className={`flex flex-col rounded-2xl border transition-all ${
                day.isToday
                  ? "border-[var(--accent)] bg-[var(--surface)] shadow-md ring-1 ring-[var(--accent)]/40"
                  : "border-[var(--border)] bg-[var(--surface)] shadow-xs"
              }`}
            >
              {/* Day Header */}
              <div
                onClick={() => onSelectDate(day.date)}
                className={`p-3 border-b border-[var(--border)] cursor-pointer select-none rounded-t-2xl transition ${
                  day.isToday
                    ? "bg-[var(--accent-soft)]"
                    : "bg-[var(--surface-2)]/40 hover:bg-[var(--surface-hover)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      day.isToday ? "text-[var(--accent)]" : "text-[var(--text-dim)]"
                    }`}
                  >
                    {day.dayName}
                  </span>
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                      day.isToday
                        ? "bg-[var(--accent)] text-white shadow-xs"
                        : "text-[var(--text)]"
                    }`}
                  >
                    {day.dayNumber}
                  </span>
                </div>

                <div className="mt-2 space-y-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-faint)]">Logged:</span>
                    <span className="mono font-bold text-[var(--text)]">
                      {formatMinutes(day.totalMinutes)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[var(--text-faint)]">Check-in:</span>
                    {day.checkIn ? (
                      <span className="font-semibold text-[var(--ok)]">
                        {formatTimeAmPm(day.checkIn.checkInTime)}
                      </span>
                    ) : (
                      <span className="text-[var(--text-faint)]">—</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Day Slots List */}
              <div className="p-2 space-y-2 flex-1 min-h-[140px] max-h-[420px] overflow-y-auto">
                {day.entries.length === 0 ? (
                  <div className="h-full flex items-center justify-center p-3 text-center text-[11px] text-[var(--text-faint)]">
                    No tasks
                  </div>
                ) : (
                  day.entries.map((slot) => (
                    <div
                      key={slot.id}
                      className="group rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 hover:bg-[var(--surface-hover)] p-2.5 transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <CategoryBadge category={slot.category} size="sm" />
                        <span className="mono text-[10.5px] font-bold text-[var(--accent)] shrink-0">
                          {formatMinutes(slot.durationMinutes)}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-[var(--text)] line-clamp-2 leading-tight">
                        {slot.taskTitle}
                      </div>

                      {slot.projectName && (
                        <div className="mono text-[9px] text-[var(--text-faint)] font-bold truncate">
                          [{slot.projectKey || slot.projectName}]
                        </div>
                      )}

                      {/* Edit/Delete actions (only for today) */}
                      {day.isToday && (
                        <div className="flex items-center justify-end gap-1 pt-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => onEditSlot(slot)}
                            className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition cursor-pointer"
                            title="Edit"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSlot(slot.id)}
                            className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--crit)] hover:bg-[var(--crit-soft)] transition cursor-pointer"
                            title="Delete"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Bottom Action: ONLY for today! */}
              {day.isToday && (
                <div className="p-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => onAddSlot(day.date)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] hover:opacity-95 text-white py-2 text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Add Today</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
