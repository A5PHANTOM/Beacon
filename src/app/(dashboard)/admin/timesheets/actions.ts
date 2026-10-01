"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  TIMESHEET_CATEGORIES,
  getCategoryMeta,
} from "@/lib/timesheet-constants";
import type {
  AdminTimesheetReportData,
  TaskSlotDto,
  DailyCheckInDto,
} from "@/lib/timesheet-types";

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

function resolveDateRange(
  preset: string = "this_month",
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string } {
  const today = new Date();
  const todayStr = getLocalDateString(today);

  if (preset === "today") {
    return { startDate: todayStr, endDate: todayStr };
  }

  if (preset === "this_week") {
    const day = today.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMon);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      startDate: getLocalDateString(monday),
      endDate: getLocalDateString(sunday),
    };
  }

  if (preset === "last_week") {
    const day = today.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const lastMon = new Date(today);
    lastMon.setDate(today.getDate() + diffToMon - 7);
    const lastSun = new Date(lastMon);
    lastSun.setDate(lastMon.getDate() + 6);
    return {
      startDate: getLocalDateString(lastMon),
      endDate: getLocalDateString(lastSun),
    };
  }

  if (preset === "last_month") {
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstOfLastMonth = new Date(year, month - 1, 1);
    const lastOfLastMonth = new Date(year, month, 0);
    return {
      startDate: getLocalDateString(firstOfLastMonth),
      endDate: getLocalDateString(lastOfLastMonth),
    };
  }

  if (preset === "custom" && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }

  // Default: this_month
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    startDate: getLocalDateString(firstOfMonth),
    endDate: getLocalDateString(lastOfMonth),
  };
}

export async function getAdminTimesheetReportsAction(filters?: {
  preset?: string;
  startDate?: string;
  endDate?: string;
  memberId?: string;
  category?: string;
  projectId?: string;
}): Promise<{
  success: boolean;
  data?: AdminTimesheetReportData;
  error?: string;
}> {
  try {
    // 0. Non-negotiable server-side admin check
    await requireAdmin();

    const preset = filters?.preset || "this_month";
    const { startDate, endDate } = resolveDateRange(
      preset,
      filters?.startDate,
      filters?.endDate
    );

    // Build Prisma where conditions
    const entryWhere: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    const checkInWhere: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (filters?.memberId && filters.memberId !== "ALL") {
      entryWhere.userId = filters.memberId;
      checkInWhere.userId = filters.memberId;
    }

    if (filters?.category && filters.category !== "ALL") {
      entryWhere.category = filters.category;
    }

    if (filters?.projectId && filters.projectId !== "ALL") {
      entryWhere.projectId = filters.projectId;
    }

    // Parallel query execution
    const [rawEntries, rawCheckIns, allUsers, allProjects] = await Promise.all([
      prisma.timesheetEntry.findMany({
        where: entryWhere,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          project: { select: { id: true, name: true, key: true } },
          issue: { select: { id: true, number: true, title: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.dailyCheckIn.findMany({
        where: checkInWhere,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: [{ date: "desc" }, { checkInTime: "asc" }],
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
      prisma.project.findMany({
        select: { id: true, name: true, key: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // Map entries to TaskSlotDto
    const recentEntries: TaskSlotDto[] = rawEntries.map((e) => ({
      id: e.id,
      userId: e.userId,
      userName: e.user.name,
      userEmail: e.user.email,
      projectId: e.projectId,
      projectName: e.project?.name || null,
      projectKey: e.project?.key || null,
      issueId: e.issueId,
      issueNumber: e.issue?.number || null,
      issueTitle: e.issue?.title || null,
      date: e.date,
      startTime: e.startTime,
      endTime: e.endTime,
      durationMinutes: e.durationMinutes,
      category: e.category,
      taskTitle: e.taskTitle,
      description: e.description,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));

    // Map check-ins to DailyCheckInDto
    const dailyCheckInLogs: DailyCheckInDto[] = rawCheckIns.map((c) => {
      let durationMinutes: number | undefined;
      if (c.checkInTime && c.checkOutTime) {
        const diff =
          new Date(c.checkOutTime).getTime() - new Date(c.checkInTime).getTime();
        durationMinutes = Math.max(0, Math.round(diff / 60000));
      }
      return {
        id: c.id,
        userId: c.userId,
        userName: c.user.name,
        date: c.date,
        checkInTime: c.checkInTime.toISOString(),
        checkOutTime: c.checkOutTime ? c.checkOutTime.toISOString() : null,
        workLocation: c.workLocation,
        notes: c.notes,
        status: c.status,
        durationMinutes,
      };
    });

    // Compute Category Breakdown
    const catMap = new Map<string, { totalMinutes: number; count: number }>();
    TIMESHEET_CATEGORIES.forEach((c) => {
      catMap.set(c.value, { totalMinutes: 0, count: 0 });
    });

    let totalMinutesAll = 0;
    recentEntries.forEach((e) => {
      totalMinutesAll += e.durationMinutes;
      const current = catMap.get(e.category) || { totalMinutes: 0, count: 0 };
      catMap.set(e.category, {
        totalMinutes: current.totalMinutes + e.durationMinutes,
        count: current.count + 1,
      });
    });

    const categoryBreakdown = TIMESHEET_CATEGORIES.map((c) => {
      const stats = catMap.get(c.value) || { totalMinutes: 0, count: 0 };
      const hours = Number((stats.totalMinutes / 60).toFixed(1));
      return {
        category: c.value,
        label: c.label,
        color: c.color,
        totalMinutes: stats.totalMinutes,
        totalHours: hours,
        slotsCount: stats.count,
        percentage:
          totalMinutesAll > 0
            ? Math.round((stats.totalMinutes / totalMinutesAll) * 100)
            : 0,
      };
    });

    // Compute Member Summaries
    const memberSummaryMap = new Map<
      string,
      {
        userId: string;
        name: string;
        email: string;
        role: string;
        checkInDates: Set<string>;
        checkInHoursList: number[];
        totalMinutes: number;
        categoryMinutes: Record<string, number>;
      }
    >();

    allUsers.forEach((u) => {
      memberSummaryMap.set(u.id, {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        checkInDates: new Set<string>(),
        checkInHoursList: [],
        totalMinutes: 0,
        categoryMinutes: {},
      });
    });

    rawCheckIns.forEach((c) => {
      const mem = memberSummaryMap.get(c.userId);
      if (mem) {
        mem.checkInDates.add(c.date);
        const inDate = new Date(c.checkInTime);
        const hourOfDay = inDate.getHours() + inDate.getMinutes() / 60;
        mem.checkInHoursList.push(hourOfDay);
      }
    });

    recentEntries.forEach((e) => {
      const mem = memberSummaryMap.get(e.userId);
      if (mem) {
        mem.totalMinutes += e.durationMinutes;
        mem.categoryMinutes[e.category] =
          (mem.categoryMinutes[e.category] || 0) + e.durationMinutes;
      }
    });

    const memberSummaries = Array.from(memberSummaryMap.values())
      .filter((m) => {
        if (filters?.memberId && filters.memberId !== "ALL") {
          return m.userId === filters.memberId;
        }
        return true;
      })
      .map((m) => {
        let avgCheckInTime: string | null = null;
        if (m.checkInHoursList.length > 0) {
          const avgHourDec =
            m.checkInHoursList.reduce((a, b) => a + b, 0) /
            m.checkInHoursList.length;
          const h = Math.floor(avgHourDec);
          const min = Math.round((avgHourDec - h) * 60);
          const period = h >= 12 ? "PM" : "AM";
          const displayH = h % 12 === 0 ? 12 : h % 12;
          avgCheckInTime = `${displayH}:${min.toString().padStart(2, "0")} ${period}`;
        }

        const categoryHours: Record<string, number> = {};
        for (const [k, v] of Object.entries(m.categoryMinutes)) {
          categoryHours[k] = Number((v / 60).toFixed(1));
        }

        return {
          userId: m.userId,
          name: m.name,
          email: m.email,
          role: m.role,
          daysCheckedIn: m.checkInDates.size,
          totalHoursLogged: Number((m.totalMinutes / 60).toFixed(1)),
          avgCheckInTime,
          categoryHours,
        };
      })
      .sort((a, b) => b.totalHoursLogged - a.totalHoursLogged);

    // Active members in this range
    const activeMemberIds = new Set<string>();
    recentEntries.forEach((e) => activeMemberIds.add(e.userId));
    rawCheckIns.forEach((c) => activeMemberIds.add(c.userId));

    // Check-in on-time compliance (< 10:00 AM)
    let onTimeCount = 0;
    rawCheckIns.forEach((c) => {
      const inDate = new Date(c.checkInTime);
      const minutesOfDay = inDate.getHours() * 60 + inDate.getMinutes();
      if (minutesOfDay <= 10 * 60) {
        onTimeCount++;
      }
    });

    const onTimeCheckInPercentage =
      rawCheckIns.length > 0
        ? Math.round((onTimeCount / rawCheckIns.length) * 100)
        : 100;

    const totalHoursLogged = Number((totalMinutesAll / 60).toFixed(1));
    const activeMembersCount = activeMemberIds.size;
    const avgDailyHoursPerMember =
      activeMembersCount > 0
        ? Number((totalHoursLogged / activeMembersCount).toFixed(1))
        : 0;

    const result: AdminTimesheetReportData = {
      filterRange: {
        startDate,
        endDate,
        preset,
      },
      metrics: {
        totalHoursLogged,
        totalTaskSlots: recentEntries.length,
        activeMembersCount,
        totalCheckInsRecorded: rawCheckIns.length,
        avgDailyHoursPerMember,
        onTimeCheckInPercentage,
      },
      categoryBreakdown,
      memberSummaries,
      recentEntries,
      dailyCheckInLogs,
      allMembers: allUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
      })),
      allProjects: allProjects.map((p) => ({
        id: p.id,
        name: p.name,
        key: p.key,
      })),
    };

    return { success: true, data: result };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to load admin timesheet report";
    return { success: false, error: message };
  }
}
