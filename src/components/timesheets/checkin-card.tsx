"use client";

import React, { useState, useEffect } from "react";
import type { DailyCheckInDto } from "@/lib/timesheet-types";
import { formatMinutes } from "@/lib/timesheet-constants";

export function CheckInCard({
  checkIn,
  todayTotalMinutes,
  onCheckIn,
  onCheckOut,
}: {
  checkIn: DailyCheckInDto | null;
  todayTotalMinutes: number;
  onCheckIn: (location: "OFFICE" | "REMOTE" | "HYBRID") => Promise<void>;
  onCheckOut: () => Promise<void>;
}) {
  const [selectedLocation, setSelectedLocation] = useState<"OFFICE" | "REMOTE" | "HYBRID">("OFFICE");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const isCheckedIn = Boolean(checkIn && !checkIn.checkOutTime);
  const isCompleted = Boolean(checkIn && checkIn.checkOutTime);

  // Live timer tick when active check-in is ongoing
  useEffect(() => {
    if (!isCheckedIn || !checkIn?.checkInTime) {
      setElapsedSeconds(0);
      return;
    }

    const inTime = new Date(checkIn.checkInTime).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      const diffSecs = Math.max(0, Math.floor((now - inTime) / 1000));
      setElapsedSeconds(diffSecs);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [isCheckedIn, checkIn?.checkInTime]);

  const formatElapsed = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClockIn = async () => {
    try {
      setLoading(true);
      await onCheckIn(selectedLocation);
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setLoading(true);
      await onCheckOut();
    } finally {
      setLoading(false);
    }
  };

  const formatTimeOnly = (isoString?: string | null) => {
    if (!isoString) return "—";
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs relative overflow-hidden transition-all">
      {/* Decorative gradient glow line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[var(--accent)] via-[var(--info)] to-[var(--ok)] opacity-70" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Status & Live Timer */}
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
              isCheckedIn
                ? "bg-[var(--ok-soft)] border-[var(--ok)] text-[var(--ok)]"
                : isCompleted
                ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]"
                : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-faint)]"
            }`}
          >
            {isCheckedIn ? (
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ok)] opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[var(--ok)]" />
              </span>
            ) : isCompleted ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-faint)]">
                Daily Check-In
              </span>
              {checkIn?.workLocation && (
                <span className="rounded bg-[var(--surface-2)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--text-dim)] border border-[var(--border)]">
                  {checkIn.workLocation === "OFFICE"
                    ? "🏢 Office"
                    : checkIn.workLocation === "REMOTE"
                    ? "🏠 Remote"
                    : "🔄 Hybrid"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 mt-0.5">
              {isCheckedIn ? (
                <>
                  <span className="text-base font-extrabold text-[var(--text)]">
                    Checked in at {formatTimeOnly(checkIn?.checkInTime)}
                  </span>
                  <span className="mono text-xs font-bold text-[var(--ok)] bg-[var(--ok-soft)] px-2 py-0.5 rounded-md border border-[var(--ok)]/30">
                    ⏱️ {formatElapsed(elapsedSeconds)}
                  </span>
                </>
              ) : isCompleted ? (
                <>
                  <span className="text-base font-extrabold text-[var(--text)]">
                    {formatTimeOnly(checkIn?.checkInTime)} – {formatTimeOnly(checkIn?.checkOutTime)}
                  </span>
                  {checkIn?.durationMinutes && (
                    <span className="mono text-xs font-bold text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 rounded-md">
                      {formatMinutes(checkIn.durationMinutes)} clocked
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm font-semibold text-[var(--text-dim)]">
                  You have not clocked in for today
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Hours comparison meter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-[var(--surface-2)] border border-[var(--border)] px-4 py-2.5 rounded-xl">
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Logged Task Time
            </div>
            <div className="mono text-sm font-extrabold text-[var(--text)]">
              {formatMinutes(todayTotalMinutes)}
            </div>
          </div>

          <div className="h-7 w-[1px] bg-[var(--border)] hidden sm:block" />

          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Daily Target
            </div>
            <div className="mono text-xs font-semibold text-[var(--text-dim)]">
              8h 00m (
              <span className="font-bold text-[var(--accent)]">
                {Math.min(100, Math.round((todayTotalMinutes / 480) * 100))}%
              </span>
              )
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-24 h-2 bg-[var(--border)] rounded-full overflow-hidden shrink-0">
            <div
              className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (todayTotalMinutes / 480) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 self-end lg:self-center">
          {!isCheckedIn && !isCompleted && (
            <div className="flex items-center gap-1.5">
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value as any)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
              >
                <option value="OFFICE">🏢 Office</option>
                <option value="REMOTE">🏠 Remote</option>
                <option value="HYBRID">🔄 Hybrid</option>
              </select>

              <button
                type="button"
                onClick={handleClockIn}
                disabled={loading}
                className="btn-primary rounded-lg bg-[var(--accent)] text-white px-4 py-1.5 text-xs font-bold shadow-xs hover:opacity-95 transition cursor-pointer flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                <span>Clock In</span>
              </button>
            </div>
          )}

          {isCheckedIn && (
            <button
              type="button"
              onClick={handleClockOut}
              disabled={loading}
              className="rounded-lg bg-[var(--crit-soft)] border border-[var(--crit-bd)] text-[var(--crit)] hover:bg-[var(--crit)] hover:text-white px-4 py-1.5 text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Clock Out</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
