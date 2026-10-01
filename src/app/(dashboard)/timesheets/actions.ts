"use server";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  createTaskSlotSchema,
  updateTaskSlotSchema,
  deleteTaskSlotSchema,
  checkInSchema,
  checkOutSchema,
  manualCheckInSchema,
  type CalendarViewData,
  type TaskSlotDto,
  type DailyCheckInDto,
  type WeekDaySummary,
  type MonthDayCell,
} from "@/lib/timesheet-types";
import {
  TIMESHEET_CATEGORIES,
  getCategoryMeta,
} from "@/lib/timesheet-constants";

function getLocalDateString(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function formatDisplayDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthYear(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// Convert DB TaskSlot to DTO
function toTaskSlotDto(entry: any): TaskSlotDto {
  return {
    id: entry.id,
    userId: entry.userId,
    userName: entry.user?.name || "User",
    userEmail: entry.user?.email || "",
    projectId: entry.projectId,
    projectName: entry.project?.name || null,
    projectKey: entry.project?.key || null,
    issueId: entry.issueId,
    issueNumber: entry.issue?.number || null,
    issueTitle: entry.issue?.title || null,
    date: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime,
    durationMinutes: entry.durationMinutes,
    category: entry.category,
    taskTitle: entry.taskTitle,
    description: entry.description,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

// Convert DB DailyCheckIn to DTO
function toDailyCheckInDto(c: any): DailyCheckInDto {
  let durationMinutes: number | undefined;
  if (c.checkInTime && c.checkOutTime) {
    const diff =
      new Date(c.checkOutTime).getTime() - new Date(c.checkInTime).getTime();
    durationMinutes = Math.max(0, Math.round(diff / 60000));
  }

  return {
    id: c.id,
    userId: c.userId,
    userName: c.user?.name || "User",
    date: c.date,
    checkInTime: c.checkInTime.toISOString(),
    checkOutTime: c.checkOutTime ? c.checkOutTime.toISOString() : null,
    workLocation: c.workLocation,
    notes: c.notes,
    status: c.status,
    durationMinutes,
  };
}

export async function getMemberCalendarDataAction(
  view: "day" | "week" | "month" = "day",
  targetDateStr?: string
): Promise<{ success: boolean; data?: CalendarViewData; error?: string }> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const todayStr = getLocalDateString();
    const activeDateStr = targetDateStr || todayStr;
    const activeDate = parseLocalDate(activeDateStr);

    // Fetch accessible projects for the slot creation form
    const accessibleProjects =
      session.user.role === "ADMIN"
        ? await prisma.project.findMany({
            select: { id: true, name: true, key: true },
            orderBy: { name: "asc" },
          })
        : await prisma.project.findMany({
            where: {
              members: { some: { userId } },
            },
            select: { id: true, name: true, key: true },
            orderBy: { name: "asc" },
          });

    // Determine query date boundary based on selected view
    let startDateStr = activeDateStr;
    let endDateStr = activeDateStr;
    let displayRangeLabel = "";

    if (view === "day") {
      startDateStr = activeDateStr;
      endDateStr = activeDateStr;
      displayRangeLabel = formatDisplayDate(activeDateStr);
    } else if (view === "week") {
      // Find Monday of the target week
      const currentDay = activeDate.getDay(); // 0 is Sun, 1 is Mon...
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(activeDate);
      monday.setDate(activeDate.getDate() + diffToMonday);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      startDateStr = getLocalDateString(monday);
      endDateStr = getLocalDateString(sunday);

      const startLabel = monday.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const endLabel = sunday.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      displayRangeLabel = `${startLabel} – ${endLabel}`;
    } else {
      // Month view
      const year = activeDate.getFullYear();
      const month = activeDate.getMonth();

      // First day of current month
      const firstOfMonth = new Date(year, month, 1);
      // Last day of current month
      const lastOfMonth = new Date(year, month + 1, 0);

      // Pad to start on Monday
      const firstDayOfWeek = firstOfMonth.getDay();
      const diffToMon = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek;
      const gridStart = new Date(firstOfMonth);
      gridStart.setDate(firstOfMonth.getDate() + diffToMon);

      // Pad to end on Sunday
      const lastDayOfWeek = lastOfMonth.getDay();
      const diffToSun = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
      const gridEnd = new Date(lastOfMonth);
      gridEnd.setDate(lastOfMonth.getDate() + diffToSun);

      startDateStr = getLocalDateString(gridStart);
      endDateStr = getLocalDateString(gridEnd);
      displayRangeLabel = formatMonthYear(activeDateStr);
    }

    // Fetch user's task entries and checkins within this date range
    const [rawEntries, rawCheckIns, todayCheckInRaw, todayEntriesRaw] =
      await Promise.all([
        prisma.timesheetEntry.findMany({
          where: {
            userId,
            date: {
              gte: startDateStr,
              lte: endDateStr,
            },
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            project: { select: { id: true, name: true, key: true } },
            issue: { select: { id: true, number: true, title: true } },
          },
          orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        }),
        prisma.dailyCheckIn.findMany({
          where: {
            userId,
            date: {
              gte: startDateStr,
              lte: endDateStr,
            },
          },
          include: {
            user: { select: { id: true, name: true } },
          },
        }),
        prisma.dailyCheckIn.findUnique({
          where: {
            userId_date: {
              userId,
              date: todayStr,
            },
          },
          include: {
            user: { select: { id: true, name: true } },
          },
        }),
        prisma.timesheetEntry.findMany({
          where: {
            userId,
            date: todayStr,
          },
          select: { durationMinutes: true },
        }),
      ]);

    const entries = rawEntries.map(toTaskSlotDto);
    const checkInMap = new Map<string, DailyCheckInDto>();
    rawCheckIns.forEach((c) => {
      checkInMap.set(c.date, toDailyCheckInDto(c));
    });

    const todayCheckIn = todayCheckInRaw ? toDailyCheckInDto(todayCheckInRaw) : null;
    const todayTotalMinutes = todayEntriesRaw.reduce(
      (sum, e) => sum + e.durationMinutes,
      0
    );

    // Compute category breakdown for the current view
    const catMap = new Map<string, { totalMinutes: number; count: number }>();
    TIMESHEET_CATEGORIES.forEach((c) => {
      catMap.set(c.value, { totalMinutes: 0, count: 0 });
    });

    let viewTotalMinutes = 0;
    entries.forEach((e) => {
      viewTotalMinutes += e.durationMinutes;
      const current = catMap.get(e.category) || { totalMinutes: 0, count: 0 };
      catMap.set(e.category, {
        totalMinutes: current.totalMinutes + e.durationMinutes,
        count: current.count + 1,
      });
    });

    const categorySummary = TIMESHEET_CATEGORIES.map((c) => {
      const stats = catMap.get(c.value) || { totalMinutes: 0, count: 0 };
      return {
        category: c.value,
        label: c.label,
        color: c.color,
        totalMinutes: stats.totalMinutes,
        count: stats.count,
        percentage:
          viewTotalMinutes > 0
            ? Math.round((stats.totalMinutes / viewTotalMinutes) * 100)
            : 0,
      };
    });

    // Assemble response according to requested view
    const result: CalendarViewData = {
      view,
      currentDate: activeDateStr,
      displayRangeLabel,
      todayCheckIn,
      todayTotalMinutes,
      categorySummary,
      accessibleProjects,
    };

    if (view === "day") {
      const dayEntries = entries.filter((e) => e.date === activeDateStr);
      const totalDurationMinutes = dayEntries.reduce(
        (sum, e) => sum + e.durationMinutes,
        0
      );
      result.dayData = {
        date: activeDateStr,
        isToday: activeDateStr === todayStr,
        checkIn: checkInMap.get(activeDateStr) || null,
        entries: dayEntries,
        totalDurationMinutes,
      };
    } else if (view === "week") {
      const currentDay = activeDate.getDay();
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(activeDate);
      monday.setDate(activeDate.getDate() + diffToMonday);

      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const weekDays: WeekDaySummary[] = [];

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dStr = getLocalDateString(d);
        const dEntries = entries.filter((e) => e.date === dStr);
        const dTotalMinutes = dEntries.reduce(
          (sum, e) => sum + e.durationMinutes,
          0
        );

        weekDays.push({
          date: dStr,
          dayName: dayNames[i],
          dayNumber: d.getDate(),
          isToday: dStr === todayStr,
          checkIn: checkInMap.get(dStr) || null,
          entries: dEntries,
          totalMinutes: dTotalMinutes,
        });
      }

      result.weekDays = weekDays;
      result.weekTotalMinutes = viewTotalMinutes;
    } else {
      // Month view
      const activeYear = activeDate.getFullYear();
      const activeMonth = activeDate.getMonth();

      const gridStart = parseLocalDate(startDateStr);
      const gridEnd = parseLocalDate(endDateStr);

      const monthDays: MonthDayCell[] = [];
      const cursor = new Date(gridStart);

      while (cursor <= gridEnd) {
        const cStr = getLocalDateString(cursor);
        const isCurrentMonth = cursor.getMonth() === activeMonth;
        const dEntries = entries.filter((e) => e.date === cStr);
        const dCheckIn = checkInMap.get(cStr);
        const dTotalMinutes = dEntries.reduce(
          (sum, e) => sum + e.durationMinutes,
          0
        );

        // Group categories for badges
        const dayCatMap = new Map<string, number>();
        dEntries.forEach((e) => {
          dayCatMap.set(e.category, (dayCatMap.get(e.category) || 0) + 1);
        });

        const categoryBadges = Array.from(dayCatMap.entries()).map(
          ([category, count]) => ({
            category,
            count,
            color: getCategoryMeta(category).color,
          })
        );

        let checkInTimeFormatted: string | null = null;
        if (dCheckIn?.checkInTime) {
          const t = new Date(dCheckIn.checkInTime);
          checkInTimeFormatted = t.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
        }

        monthDays.push({
          date: cStr,
          dayNumber: cursor.getDate(),
          isCurrentMonth,
          isToday: cStr === todayStr,
          hasCheckIn: Boolean(dCheckIn),
          checkInTimeFormatted,
          totalMinutes: dTotalMinutes,
          entryCount: dEntries.length,
          categoryBadges,
          entries: dEntries,
        });

        cursor.setDate(cursor.getDate() + 1);
      }

      result.monthDays = monthDays;
      result.monthTotalMinutes = viewTotalMinutes;
    }

    return { success: true, data: result };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to load calendar data";
    return { success: false, error: message };
  }
}

export async function createTaskSlotAction(
  rawInput: unknown
): Promise<{ success: boolean; data?: TaskSlotDto; error?: string }> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const validated = createTaskSlotSchema.parse(rawInput);
    const todayStr = getLocalDateString();
    if (validated.date !== todayStr) {
      return {
        success: false,
        error: `Task slots can only be logged for today (${todayStr}).`,
      };
    }

    // If projectId provided, check membership or admin
    if (validated.projectId) {
      if (session.user.role !== "ADMIN") {
        const isMember = await prisma.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: validated.projectId,
              userId,
            },
          },
        });
        if (!isMember) {
          return {
            success: false,
            error: "You are not a member of the selected project",
          };
        }
      }
    }

    const created = await prisma.timesheetEntry.create({
      data: {
        userId,
        date: todayStr,
        taskTitle: validated.taskTitle,
        category: validated.category,
        durationMinutes: validated.durationMinutes,
        startTime: validated.startTime || null,
        endTime: validated.endTime || null,
        projectId: validated.projectId || null,
        issueId: validated.issueId || null,
        description: validated.description || null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, key: true } },
        issue: { select: { id: true, number: true, title: true } },
      },
    });

    return { success: true, data: toTaskSlotDto(created) };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create task slot";
    return { success: false, error: message };
  }
}

export async function updateTaskSlotAction(
  rawInput: unknown
): Promise<{ success: boolean; data?: TaskSlotDto; error?: string }> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const validated = updateTaskSlotSchema.parse(rawInput);

    const existing = await prisma.timesheetEntry.findUnique({
      where: { id: validated.id },
    });

    if (!existing) {
      return { success: false, error: "Task slot not found" };
    }

    if (existing.userId !== userId && session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "Forbidden: You cannot modify another member's timesheet",
      };
    }

    const todayStr = getLocalDateString();
    if (existing.date !== todayStr) {
      return {
        success: false,
        error: "Only task slots from today can be edited.",
      };
    }

    const updated = await prisma.timesheetEntry.update({
      where: { id: validated.id },
      data: {
        date: todayStr,
        taskTitle: validated.taskTitle,
        category: validated.category,
        durationMinutes: validated.durationMinutes,
        startTime: validated.startTime || null,
        endTime: validated.endTime || null,
        projectId: validated.projectId || null,
        issueId: validated.issueId || null,
        description: validated.description || null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, key: true } },
        issue: { select: { id: true, number: true, title: true } },
      },
    });

    return { success: true, data: toTaskSlotDto(updated) };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update task slot";
    return { success: false, error: message };
  }
}

export async function deleteTaskSlotAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const validated = deleteTaskSlotSchema.parse(rawInput);

    const existing = await prisma.timesheetEntry.findUnique({
      where: { id: validated.id },
    });

    if (!existing) {
      return { success: false, error: "Task slot not found" };
    }

    if (existing.userId !== userId && session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "Forbidden: You cannot delete another member's timesheet",
      };
    }

    const todayStr = getLocalDateString();
    if (existing.date !== todayStr && session.user.role !== "ADMIN") {
      return {
        success: false,
        error: `Strict policy: Only task slots from today (${todayStr}) can be deleted.`,
      };
    }

    await prisma.timesheetEntry.delete({
      where: { id: validated.id },
    });

    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to delete task slot";
    return { success: false, error: message };
  }
}

export async function checkInAction(
  rawInput: unknown
): Promise<{ success: boolean; data?: DailyCheckInDto; error?: string }> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const validated = checkInSchema.parse(rawInput);
    const todayStr = getLocalDateString();

    if (validated.date !== todayStr) {
      return {
        success: false,
        error: `Strict policy: Check-in can only be recorded for today (${todayStr}).`,
      };
    }

    // Check if user has already checked in today
    const existing = await prisma.dailyCheckIn.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayStr,
        },
      },
    });

    if (existing && existing.checkInTime) {
      return {
        success: false,
        error: "Strict policy: You have already clocked in for today. Multiple check-ins are not permitted.",
      };
    }

    const now = new Date();
    const record = await prisma.dailyCheckIn.create({
      data: {
        userId,
        date: todayStr,
        checkInTime: now,
        workLocation: validated.workLocation,
        notes: validated.notes || null,
        status: "PRESENT",
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return { success: true, data: toDailyCheckInDto(record) };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to record check-in";
    return { success: false, error: message };
  }
}

export async function checkOutAction(
  rawInput: unknown
): Promise<{ success: boolean; data?: DailyCheckInDto; error?: string }> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const validated = checkOutSchema.parse(rawInput);
    const todayStr = getLocalDateString();

    if (validated.date !== todayStr) {
      return {
        success: false,
        error: `Strict policy: Check-out can only be recorded for today (${todayStr}).`,
      };
    }

    const existing = await prisma.dailyCheckIn.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayStr,
        },
      },
    });

    if (!existing || !existing.checkInTime) {
      return {
        success: false,
        error: "Strict policy: You must clock in before you can clock out.",
      };
    }

    if (existing.checkOutTime) {
      return {
        success: false,
        error: "Strict policy: You have already clocked out for today.",
      };
    }

    const now = new Date();
    if (now.getTime() <= new Date(existing.checkInTime).getTime()) {
      return {
        success: false,
        error: "Check-out time must be after check-in time.",
      };
    }

    const updated = await prisma.dailyCheckIn.update({
      where: {
        userId_date: {
          userId,
          date: todayStr,
        },
      },
      data: {
        checkOutTime: now,
        notes: validated.notes
          ? existing.notes
            ? `${existing.notes} | Out: ${validated.notes}`
            : validated.notes
          : undefined,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return { success: true, data: toDailyCheckInDto(updated) };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to record check-out";
    return { success: false, error: message };
  }
}

export async function manualCheckInAction(
  rawInput: unknown
): Promise<{ success: boolean; data?: DailyCheckInDto; error?: string }> {
  try {
    const session = await requireAuth();
    if (session.user.role !== "ADMIN") {
      return {
        success: false,
        error:
          "Strict policy violation: Manual check-in and check-out adjustments are strictly disabled. Members must clock in and clock out directly in real time.",
      };
    }
    const userId = session.user.id;
    const validated = manualCheckInSchema.parse(rawInput);

    const inTime = new Date(validated.checkInTime);
    const outTime = validated.checkOutTime ? new Date(validated.checkOutTime) : null;

    if (isNaN(inTime.getTime())) {
      return { success: false, error: "Invalid check-in time" };
    }

    const record = await prisma.dailyCheckIn.upsert({
      where: {
        userId_date: {
          userId,
          date: validated.date,
        },
      },
      create: {
        userId,
        date: validated.date,
        checkInTime: inTime,
        checkOutTime: outTime,
        workLocation: validated.workLocation,
        notes: validated.notes || null,
        status: validated.status,
      },
      update: {
        checkInTime: inTime,
        checkOutTime: outTime,
        workLocation: validated.workLocation,
        notes: validated.notes || null,
        status: validated.status,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return { success: true, data: toDailyCheckInDto(record) };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to save check-in adjustment";
    return { success: false, error: message };
  }
}
