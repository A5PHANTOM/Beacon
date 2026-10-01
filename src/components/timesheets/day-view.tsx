"use client";

import React from "react";
import type { DayCalendarData, TaskSlotDto } from "@/lib/timesheet-types";
import { formatMinutes, formatTimeAmPm } from "@/lib/timesheet-constants";
import { CategoryBadge } from "./category-badge";

export function DayView({
  dayData,
  onAddSlot,
  onEditSlot,
  onDeleteSlot,
}: {
  dayData?: DayCalendarData;
  onAddSlot: (date: string) => void;
  onEditSlot: (slot: TaskSlotDto) => void;
  onDeleteSlot: (slotId: string) => void;
}) {
  if (!dayData) {
    return <div className="p-8 text-center text-xs text-[var(--text-dim)]">Loading…</div>;
  }

  const { date, isToday, checkIn, entries, totalDurationMinutes } = dayData;
  const targetMinutes = 480; // 8 hours
  const percentage = Math.min(100, Math.round((totalDurationMinutes / targetMinutes) * 100));

  return (
    <div className="space-y-5">
      {/* Day Attendance & Target Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Attendance Summary */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Daily Attendance
            </span>
          </div>
          {checkIn ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--ok)]" />
                <span className="text-xs font-bold text-[var(--text)]">
                  In: {formatTimeAmPm(checkIn.checkInTime)}
                </span>
                {checkIn.checkOutTime && (
                  <span className="text-xs text-[var(--text-dim)]">
                    • Out: {formatTimeAmPm(checkIn.checkOutTime)}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[var(--text-faint)]">
                Location: {checkIn.workLocation || "Office"}
              </div>
            </div>
          ) : (
            <div className="text-xs text-[var(--text-faint)] italic">
              {isToday ? "Not checked in yet today" : "No check-in recorded"}
            </div>
          )}
        </div>

        {/* Task Duration vs Target */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs md:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Total Logged Time
            </span>
            <span className="mono text-xs font-bold text-[var(--accent)]">
              {percentage}% of 8h Target
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="mono text-2xl font-black text-[var(--text)]">
              {formatMinutes(totalDurationMinutes)}
            </span>
            <span className="text-xs font-medium text-[var(--text-dim)]">
              ({entries.length} task slot{entries.length === 1 ? "" : "s"})
            </span>
          </div>

          <div className="w-full bg-[var(--surface-2)] rounded-full h-2 mt-3 border border-[var(--border)] overflow-hidden">
            <div
              className="bg-[var(--accent)] h-full rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Task Slots List */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">
              {isToday ? "Today's Task Slots" : `Task Slots for ${date}`}
            </h3>
            <p className="text-xs text-[var(--text-dim)]">
              {isToday
                ? "You can add task slots for today."
                : "Viewing a past date. Tasks can only be added for the current day."}
            </p>
          </div>

          {/* Add Slot Button: ONLY allowed if isToday! */}
          {isToday ? (
            <button
              type="button"
              onClick={() => onAddSlot(date)}
              className="btn-primary rounded-xl bg-[var(--accent)] text-white px-4 py-2 text-xs font-bold shadow-xs hover:opacity-95 transition cursor-pointer flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add Task Slot</span>
            </button>
          ) : (
            <span className="rounded-lg bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--text-faint)] font-semibold border border-[var(--border)]">
              Past Date (Read Only)
            </span>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="p-10 text-center border-2 border-dashed border-[var(--border)] rounded-2xl space-y-2">
            <div className="text-xs font-bold text-[var(--text)]">No task slots logged for this day</div>
            {isToday ? (
              <p className="text-xs text-[var(--text-dim)]">
                Click <b>Add Task Slot</b> above to record the tasks you worked on today.
              </p>
            ) : (
              <p className="text-xs text-[var(--text-faint)]">
                No slots were logged on this date.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((slot) => (
              <div
                key={slot.id}
                className="group rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 hover:bg-[var(--surface-hover)] p-3.5 transition-all flex items-center justify-between gap-3"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryBadge category={slot.category} size="sm" />
                    {slot.projectName && (
                      <span className="mono text-[10px] font-bold text-[var(--text-faint)] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                        {slot.projectKey || slot.projectName}
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-bold text-[var(--text)] truncate">
                    {slot.taskTitle}
                  </div>

                  {slot.description && (
                    <div className="text-xs text-[var(--text-dim)] truncate">
                      {slot.description}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="mono text-xs font-black text-[var(--accent)] bg-[var(--surface)] px-2.5 py-1 rounded-lg border border-[var(--border)]">
                    {formatMinutes(slot.durationMinutes)}
                  </div>

                  {isToday && (
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => onEditSlot(slot)}
                        className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition cursor-pointer"
                        title="Edit slot"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSlot(slot.id)}
                        className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--crit)] hover:bg-[var(--crit-soft)] transition cursor-pointer"
                        title="Delete slot"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
