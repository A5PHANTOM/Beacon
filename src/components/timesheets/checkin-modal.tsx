"use client";

import React, { useState, useEffect } from "react";
import type { DailyCheckInDto } from "@/lib/timesheet-types";

export function CheckInModal({
  isOpen,
  onClose,
  initialDate,
  currentCheckIn,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialDate: string;
  currentCheckIn?: DailyCheckInDto | null;
  onSave: (data: {
    date: string;
    checkInTime: string;
    checkOutTime?: string;
    workLocation: "OFFICE" | "REMOTE" | "HYBRID";
    notes?: string;
    status: "PRESENT" | "HALF_DAY" | "ON_LEAVE";
  }) => Promise<void>;
}) {
  const [date, setDate] = useState(initialDate);
  const [inTime, setInTime] = useState("09:00");
  const [outTime, setOutTime] = useState("");
  const [workLocation, setWorkLocation] = useState<"OFFICE" | "REMOTE" | "HYBRID">("OFFICE");
  const [status, setStatus] = useState<"PRESENT" | "HALF_DAY" | "ON_LEAVE">("PRESENT");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDate(initialDate);
    if (currentCheckIn) {
      const inD = new Date(currentCheckIn.checkInTime);
      const inH = String(inD.getHours()).padStart(2, "0");
      const inM = String(inD.getMinutes()).padStart(2, "0");
      setInTime(`${inH}:${inM}`);

      if (currentCheckIn.checkOutTime) {
        const outD = new Date(currentCheckIn.checkOutTime);
        const outH = String(outD.getHours()).padStart(2, "0");
        const outM = String(outD.getMinutes()).padStart(2, "0");
        setOutTime(`${outH}:${outM}`);
      } else {
        setOutTime("");
      }

      setWorkLocation((currentCheckIn.workLocation as any) || "OFFICE");
      setStatus((currentCheckIn.status as any) || "PRESENT");
      setNotes(currentCheckIn.notes || "");
    } else {
      setInTime("09:00");
      setOutTime("");
      setWorkLocation("OFFICE");
      setStatus("PRESENT");
      setNotes("");
    }
    setError(null);
  }, [currentCheckIn, initialDate, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inTime) {
      setError("Please specify a valid check-in time.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Construct full ISO strings for the specified date
      const [inH, inM] = inTime.split(":").map(Number);
      const [y, m, d] = date.split("-").map(Number);
      const fullInDate = new Date(y, m - 1, d, inH, inM, 0);

      let fullOutIso: string | undefined;
      if (outTime) {
        const [outH, outM] = outTime.split(":").map(Number);
        const fullOutDate = new Date(y, m - 1, d, outH, outM, 0);
        fullOutIso = fullOutDate.toISOString();
      }

      await onSave({
        date,
        checkInTime: fullInDate.toISOString(),
        checkOutTime: fullOutIso,
        workLocation,
        notes: notes.trim() || undefined,
        status,
      });

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record check-in";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">
              {currentCheckIn ? "Adjust Daily Check-in" : "Record Daily Check-in"}
            </h2>
            <p className="text-xs text-[var(--text-dim)] mt-0.5">
              Set or update your arrival and departure times
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
          <div className="rounded-lg bg-[var(--crit-soft)] border border-[var(--crit-bd)] px-3 py-2 text-xs text-[var(--crit)] flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1">
              Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1">
                Check-in Time <span className="text-[var(--crit)]">*</span>
              </label>
              <input
                type="time"
                required
                value={inTime}
                onChange={(e) => setInTime(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-bold text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1">
                Check-out Time (Optional)
              </label>
              <input
                type="time"
                value={outTime}
                onChange={(e) => setOutTime(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-bold text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1">
                Work Location
              </label>
              <select
                value={workLocation}
                onChange={(e) => setWorkLocation(e.target.value as any)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
              >
                <option value="OFFICE">🏢 Office</option>
                <option value="REMOTE">🏠 Remote</option>
                <option value="HYBRID">🔄 Hybrid</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1">
                Attendance Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
              >
                <option value="PRESENT">Full Day Present</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="ON_LEAVE">On Leave</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1">
              Check-in Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Worked from client location, doctor appointment in morning"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-hidden focus:border-[var(--accent)]"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-[var(--text-dim)] hover:bg-[var(--surface-hover)] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary rounded-lg bg-[var(--accent)] text-white px-5 py-2 text-xs font-semibold shadow-sm hover:opacity-95 disabled:opacity-50 transition cursor-pointer"
            >
              {submitting ? "Saving…" : "Save Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
