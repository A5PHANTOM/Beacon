"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import type { CalendarViewData, TaskSlotDto } from "@/lib/timesheet-types";
import {
  getMemberCalendarDataAction,
  createTaskSlotAction,
  updateTaskSlotAction,
  deleteTaskSlotAction,
  checkInAction,
  checkOutAction,
  manualCheckInAction,
} from "@/app/(dashboard)/timesheets/actions";
import { CheckInCard } from "./checkin-card";
import { DayView } from "./day-view";
import { WeekView } from "./week-view";
import { MonthView } from "./month-view";
import { TaskSlotModal } from "./task-slot-modal";
import { CheckInModal } from "./checkin-modal";
import { formatMinutes } from "@/lib/timesheet-constants";

export function TimesheetView({
  initialData,
}: {
  initialData: CalendarViewData;
}) {
  const [data, setData] = useState<CalendarViewData>(initialData);
  const [view, setView] = useState<"day" | "week" | "month">(initialData.view);
  const [currentDate, setCurrentDate] = useState<string>(initialData.currentDate);
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TaskSlotDto | null>(null);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);

  // Notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Compute today's date string
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Fetch updated data from server
  const refreshData = useCallback(
    async (targetView = view, targetDate = currentDate) => {
      startTransition(async () => {
        const res = await getMemberCalendarDataAction(targetView, targetDate);
        if (res.success && res.data) {
          setData(res.data);
          setView(res.data.view);
          setCurrentDate(res.data.currentDate);
        } else if (res.error) {
          showToast(`Error: ${res.error}`);
        }
      });
    },
    [view, currentDate]
  );

  const handleSwitchView = (newView: "day" | "week" | "month") => {
    setView(newView);
    refreshData(newView, currentDate);
  };

  // Date navigation handlers
  const handleNav = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      setCurrentDate(todayStr);
      refreshData(view, todayStr);
      return;
    }

    const [y, m, d] = currentDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);

    if (view === "day") {
      dateObj.setDate(dateObj.getDate() + (direction === "next" ? 1 : -1));
    } else if (view === "week") {
      dateObj.setDate(dateObj.getDate() + (direction === "next" ? 7 : -7));
    } else {
      dateObj.setMonth(dateObj.getMonth() + (direction === "next" ? 1 : -1));
    }

    const nextY = dateObj.getFullYear();
    const nextM = String(dateObj.getMonth() + 1).padStart(2, "0");
    const nextD = String(dateObj.getDate()).padStart(2, "0");
    const nextDateStr = `${nextY}-${nextM}-${nextD}`;

    setCurrentDate(nextDateStr);
    refreshData(view, nextDateStr);
  };

  // Slot modal triggers: strictly enforce today's date
  const handleOpenAddSlot = () => {
    setEditingSlot(null);
    setSlotModalOpen(true);
  };

  const handleOpenEditSlot = (slot: TaskSlotDto) => {
    setEditingSlot(slot);
    setSlotModalOpen(true);
  };

  const handleSaveSlot = async (slotInput: {
    id?: string;
    date: string;
    taskTitle: string;
    category: string;
    durationMinutes: number;
    projectId?: string;
    description?: string;
  }) => {
    if (slotInput.id) {
      const res = await updateTaskSlotAction(slotInput);
      if (!res.success) throw new Error(res.error || "Failed to update slot");
      showToast("Task slot updated");
    } else {
      const res = await createTaskSlotAction(slotInput);
      if (!res.success) throw new Error(res.error || "Failed to create slot");
      showToast("Task slot logged for today");
    }
    await refreshData(view, currentDate);
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to delete this task slot?")) return;
    const res = await deleteTaskSlotAction({ id: slotId });
    if (res.success) {
      showToast("Task slot deleted");
      await refreshData(view, currentDate);
    } else {
      showToast(`Error: ${res.error}`);
    }
  };

  // Attendance Check-in triggers
  const handleCheckIn = async (workLocation: "OFFICE" | "REMOTE" | "HYBRID") => {
    const res = await checkInAction({
      date: todayStr,
      workLocation,
    });
    if (res.success) {
      showToast("Checked in successfully!");
      await refreshData(view, currentDate);
    } else {
      showToast(`Check-in failed: ${res.error}`);
    }
  };

  const handleCheckOut = async () => {
    const res = await checkOutAction({
      date: todayStr,
    });
    if (res.success) {
      showToast("Checked out for today");
      await refreshData(view, currentDate);
    } else {
      showToast(`Check-out failed: ${res.error}`);
    }
  };

  const handleManualCheckInSave = async (inputData: {
    date: string;
    checkInTime: string;
    checkOutTime?: string;
    workLocation: "OFFICE" | "REMOTE" | "HYBRID";
    notes?: string;
    status: "PRESENT" | "HALF_DAY" | "ON_LEAVE";
  }) => {
    const res = await manualCheckInAction(inputData);
    if (!res.success) throw new Error(res.error || "Failed to adjust check-in");
    showToast("Check-in record saved");
    await refreshData(view, currentDate);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 animate-float-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-[var(--surface)] border border-[var(--border)] px-4 py-2.5 shadow-xl flex items-center gap-2 text-xs font-semibold text-[var(--text)]">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[var(--text)] tracking-tight">
            Timesheets & Attendance
          </h1>
          <p className="text-xs text-[var(--text-dim)] mt-0.5">
            Log your daily tasks for today and track check-in attendance
          </p>
        </div>

        {/* View Switcher & Primary Action */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
            <button
              type="button"
              onClick={() => handleSwitchView("day")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                view === "day"
                  ? "bg-[var(--surface)] text-[var(--accent)] shadow-xs"
                  : "text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => handleSwitchView("week")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                view === "week"
                  ? "bg-[var(--surface)] text-[var(--accent)] shadow-xs"
                  : "text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => handleSwitchView("month")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                view === "month"
                  ? "bg-[var(--surface)] text-[var(--accent)] shadow-xs"
                  : "text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}
            >
              Month
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenAddSlot}
            className="btn-primary rounded-xl bg-[var(--accent)] text-white px-4 py-2 text-xs font-bold shadow-sm hover:opacity-95 transition cursor-pointer flex items-center gap-1.5"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Log Today's Task</span>
          </button>
        </div>
      </div>

      {/* Live Today's Check-in Card */}
      <CheckInCard
        checkIn={data.todayCheckIn}
        todayTotalMinutes={data.todayTotalMinutes}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
        onOpenAdjustModal={() => setCheckInModalOpen(true)}
      />

      {/* Simple Calendar Navigation Bar */}
      <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleNav("prev")}
            className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-hover)] text-[var(--text)] transition cursor-pointer"
            title="Previous"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => handleNav("today")}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-hover)] px-3 py-1 text-xs font-bold text-[var(--text)] transition cursor-pointer"
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => handleNav("next")}
            className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-hover)] text-[var(--text)] transition cursor-pointer"
            title="Next"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <span className="mono text-sm font-extrabold text-[var(--text)] ml-2">
            {data.displayRangeLabel}
          </span>
        </div>

        <div className="text-xs text-[var(--text-faint)] font-medium hidden sm:block">
          Task logging is enabled for <b>Today</b> only.
        </div>
      </div>

      {/* Active Calendar View */}
      <div className={isPending ? "opacity-60 pointer-events-none transition-opacity" : ""}>
        {view === "day" && (
          <DayView
            dayData={data.dayData}
            onAddSlot={handleOpenAddSlot}
            onEditSlot={handleOpenEditSlot}
            onDeleteSlot={handleDeleteSlot}
            onOpenCheckInAdjust={() => setCheckInModalOpen(true)}
          />
        )}

        {view === "week" && (
          <WeekView
            weekDays={data.weekDays}
            weekTotalMinutes={data.weekTotalMinutes}
            onAddSlot={handleOpenAddSlot}
            onEditSlot={handleOpenEditSlot}
            onDeleteSlot={handleDeleteSlot}
            onSelectDate={(date) => {
              setCurrentDate(date);
              handleSwitchView("day");
            }}
          />
        )}

        {view === "month" && (
          <MonthView
            monthDays={data.monthDays}
            monthTotalMinutes={data.monthTotalMinutes}
            onSelectDate={(date) => {
              setCurrentDate(date);
              handleSwitchView("day");
            }}
            onAddSlot={handleOpenAddSlot}
          />
        )}
      </div>

      {/* Task Slot Modal */}
      <TaskSlotModal
        isOpen={slotModalOpen}
        onClose={() => setSlotModalOpen(false)}
        initialDate={todayStr}
        editEntry={editingSlot}
        accessibleProjects={data.accessibleProjects}
        onSave={handleSaveSlot}
      />

      {/* Check-in Adjustment Modal */}
      <CheckInModal
        isOpen={checkInModalOpen}
        onClose={() => setCheckInModalOpen(false)}
        initialDate={todayStr}
        currentCheckIn={data.todayCheckIn}
        onSave={handleManualCheckInSave}
      />
    </div>
  );
}
