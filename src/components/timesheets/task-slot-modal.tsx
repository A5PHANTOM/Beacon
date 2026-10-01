"use client";

import React, { useState, useEffect } from "react";
import { TIMESHEET_CATEGORIES, formatMinutes } from "@/lib/timesheet-constants";
import type { TaskSlotDto } from "@/lib/timesheet-types";

type AccessibleProject = {
  id: string;
  name: string;
  key: string;
};

export function TaskSlotModal({
  isOpen,
  onClose,
  initialDate,
  editEntry,
  accessibleProjects,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialDate: string;
  editEntry?: TaskSlotDto | null;
  accessibleProjects: AccessibleProject[];
  onSave: (data: {
    id?: string;
    date: string;
    taskTitle: string;
    category: string;
    durationMinutes: number;
    projectId?: string;
    description?: string;
  }) => Promise<void>;
}) {
  const [taskTitle, setTaskTitle] = useState("");
  const [category, setCategory] = useState<string>("TASK");
  const [hours, setHours] = useState<number>(1);
  const [minutes, setMinutes] = useState<number>(0);
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute today's date string in YYYY-MM-DD
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const targetDate = editEntry ? editEntry.date : todayStr;

  useEffect(() => {
    if (editEntry) {
      setTaskTitle(editEntry.taskTitle);
      setCategory(editEntry.category);
      const h = Math.floor(editEntry.durationMinutes / 60);
      const m = editEntry.durationMinutes % 60;
      setHours(h);
      setMinutes(m);
      setProjectId(editEntry.projectId || "");
      setDescription(editEntry.description || "");
    } else {
      setTaskTitle("");
      setCategory("TASK");
      setHours(1);
      setMinutes(0);
      setProjectId(accessibleProjects[0]?.id || "");
      setDescription("");
    }
    setError(null);
  }, [editEntry, accessibleProjects, isOpen]);

  const totalCalculatedMinutes = hours * 60 + minutes;

  const handlePreset = (mins: number) => {
    setHours(Math.floor(mins / 60));
    setMinutes(mins % 60);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      setError("Please enter the task you worked on.");
      return;
    }
    if (totalCalculatedMinutes <= 0) {
      setError("Duration must be at least 5 minutes.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSave({
        id: editEntry?.id,
        date: targetDate, // Enforce current day
        taskTitle: taskTitle.trim(),
        category,
        durationMinutes: totalCalculatedMinutes,
        projectId: projectId || undefined,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save slot";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const presets = [
    { label: "30m", mins: 30 },
    { label: "1h", mins: 60 },
    { label: "1.5h", mins: 90 },
    { label: "2h", mins: 120 },
    { label: "4h", mins: 240 },
    { label: "8h", mins: 480 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Simple Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[var(--text)]">
                {editEntry ? "Edit Task Slot" : "Log Task Slot"}
              </h2>
              <span className="rounded-full bg-[var(--ok-soft)] text-[var(--ok)] border border-[var(--ok)]/30 px-2 py-0.5 text-[10.5px] font-bold">
                Today Only
              </span>
            </div>
            <p className="text-xs text-[var(--text-dim)] mt-0.5">
              Logging for {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text)] p-1 rounded-lg hover:bg-[var(--surface-hover)] transition cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-[var(--crit-soft)] border border-[var(--crit-bd)] px-3 py-2 text-xs text-[var(--crit)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Name Input */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1">
              What task was done? <span className="text-[var(--crit)]">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g., Fixed ticket #42, API documentation, sprint planning"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-xs font-medium text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-hidden focus:border-[var(--accent)] transition"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1">
              Category <span className="text-[var(--crit)]">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-xs font-bold text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)] transition cursor-pointer"
            >
              {TIMESHEET_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label} ({cat.description})
                </option>
              ))}
            </select>
          </div>

          {/* Duration Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[var(--text-dim)]">
                Duration <span className="text-[var(--crit)]">*</span>
              </label>
              <span className="mono text-xs font-extrabold text-[var(--accent)]">
                {formatMinutes(totalCalculatedMinutes)}
              </span>
            </div>

            {/* Quick preset buttons */}
            <div className="grid grid-cols-6 gap-1.5 mb-2.5">
              {presets.map((p) => {
                const isSelected = totalCalculatedMinutes === p.mins;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handlePreset(p.mins)}
                    className={`rounded-lg py-1.5 text-xs font-bold transition cursor-pointer text-center ${
                      isSelected
                        ? "bg-[var(--accent)] text-white shadow-xs"
                        : "bg-[var(--surface-2)] text-[var(--text-dim)] hover:bg-[var(--surface-hover)] border border-[var(--border)]"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Hours and Minutes inputs */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5">
                <span className="text-xs text-[var(--text-faint)] font-medium">Hours:</span>
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-transparent text-xs font-bold text-[var(--text)] focus:outline-hidden"
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5">
                <span className="text-xs text-[var(--text-faint)] font-medium">Mins:</span>
                <input
                  type="number"
                  min="0"
                  max="55"
                  step="5"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(0, Math.min(55, parseInt(e.target.value) || 0)))}
                  className="w-full bg-transparent text-xs font-bold text-[var(--text)] focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Project dropdown (optional) */}
          {accessibleProjects.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1">
                Project (Optional)
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)] transition"
              >
                <option value="">General (No specific project)</option>
                {accessibleProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.key}] {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notes (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="Brief details or ticket reference..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2 text-xs text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-hidden focus:border-[var(--accent)] transition"
            />
          </div>

          {/* Form Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-dim)] hover:bg-[var(--surface-hover)] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary rounded-xl bg-[var(--accent)] text-white px-5 py-2 text-xs font-bold shadow-xs hover:opacity-95 disabled:opacity-50 transition cursor-pointer"
            >
              {submitting ? "Saving…" : editEntry ? "Save Changes" : "Log Task Slot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
