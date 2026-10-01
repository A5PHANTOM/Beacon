"use server";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { TIMESHEET_CATEGORIES, formatMinutes } from "@/lib/timesheet-constants";

function getLocalDateString(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type MemberProgressData = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  targets: {
    todayMinutes: number;
    todayTargetMinutes: number;
    todayPercent: number;
    weekMinutes: number;
    weekTargetMinutes: number;
    weekPercent: number;
    monthMinutes: number;
    monthTargetMinutes: number;
    monthPercent: number;
  };
  attendance: {
    checkedInDaysThisMonth: number;
    totalMonthWorkingDays: number;
    attendancePercent: number;
    todayCheckedIn: boolean;
    todayCheckInTime: string | null;
    todayCheckOutTime: string | null;
    todayDurationMinutes: number;
  };
  categoryBreakdown: {
    category: string;
    label: string;
    color: string;
    totalMinutes: number;
    totalHours: number;
    percentage: number;
    count: number;
  }[];
  projectBreakdown: {
    projectId: string | null;
    projectName: string;
    projectKey: string;
    totalMinutes: number;
    totalHours: number;
    percentage: number;
  }[];
  weeklyVelocity: {
    date: string;
    dayName: string;
    dayNumber: number;
    isToday: boolean;
    hours: number;
    minutes: number;
  }[];
  recentActivity: {
    id: string;
    date: string;
    taskTitle: string;
    category: string;
    durationMinutes: number;
    projectName: string | null;
    projectKey: string | null;
  }[];
  teamPulse: {
    activeMembersThisWeek: number;
    totalTeamHoursThisWeek: number;
    avgHoursPerMember: number;
    topCategoryThisWeek: string;
  };
};

export async function getMemberProgressAction(): Promise<{
  success: boolean;
  data?: MemberProgressData;
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const today = new Date();
    const todayStr = getLocalDateString(today);

    // Calculate Week boundaries (Mon - Sun)
    const currentDayOfWeek = today.getDay();
    const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekStartStr = getLocalDateString(monday);
    const weekEndStr = getLocalDateString(sunday);

    // Calculate Month boundaries
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const monthStartStr = getLocalDateString(firstOfMonth);
    const monthEndStr = getLocalDateString(lastOfMonth);

    // Fetch user details, timesheet entries, and attendance records
    const [
      user,
      monthEntries,
      monthCheckIns,
      teamWeekEntries,
      teamWeekCheckIns,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true },
      }),
      prisma.timesheetEntry.findMany({
        where: {
          userId,
          date: { gte: monthStartStr, lte: monthEndStr },
        },
        include: {
          project: { select: { id: true, name: true, key: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.dailyCheckIn.findMany({
        where: {
          userId,
          date: { gte: monthStartStr, lte: monthEndStr },
        },
      }),
      prisma.timesheetEntry.findMany({
        where: {
          date: { gte: weekStartStr, lte: weekEndStr },
        },
        select: {
          userId: true,
          durationMinutes: true,
          category: true,
        },
      }),
      prisma.dailyCheckIn.findMany({
        where: {
          date: { gte: weekStartStr, lte: weekEndStr },
        },
        select: { userId: true },
      }),
    ]);

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // 1. Calculate Targets
    const todayEntries = monthEntries.filter((e) => e.date === todayStr);
    const todayMinutes = todayEntries.reduce((sum, e) => sum + e.durationMinutes, 0);
    const todayTargetMinutes = 480; // 8 hours
    const todayPercent = Math.min(100, Math.round((todayMinutes / todayTargetMinutes) * 100));

    const weekEntries = monthEntries.filter(
      (e) => e.date >= weekStartStr && e.date <= weekEndStr
    );
    const weekMinutes = weekEntries.reduce((sum, e) => sum + e.durationMinutes, 0);
    const weekTargetMinutes = 2400; // 40 hours
    const weekPercent = Math.min(100, Math.round((weekMinutes / weekTargetMinutes) * 100));

    const monthMinutes = monthEntries.reduce((sum, e) => sum + e.durationMinutes, 0);
    const monthTargetMinutes = 9600; // 160 hours (approx 20 working days)
    const monthPercent = Math.min(100, Math.round((monthMinutes / monthTargetMinutes) * 100));

    // 2. Attendance Stats
    const checkInDatesSet = new Set(monthCheckIns.map((c) => c.date));
    const todayCheckIn = monthCheckIns.find((c) => c.date === todayStr);

    let todayDurationMinutes = 0;
    if (todayCheckIn?.checkInTime && todayCheckIn.checkOutTime) {
      const diff =
        new Date(todayCheckIn.checkOutTime).getTime() -
        new Date(todayCheckIn.checkInTime).getTime();
      todayDurationMinutes = Math.max(0, Math.round(diff / 60000));
    }

    // Approx working days in month (M-F)
    let workingDaysCount = 0;
    const cur = new Date(firstOfMonth);
    while (cur <= lastOfMonth) {
      const dayW = cur.getDay();
      if (dayW !== 0 && dayW !== 6) workingDaysCount++;
      cur.setDate(cur.getDate() + 1);
    }

    const attendancePercent =
      workingDaysCount > 0
        ? Math.min(100, Math.round((checkInDatesSet.size / workingDaysCount) * 100))
        : 100;

    // 3. Category Breakdown for the User (this month)
    const catMap = new Map<string, { totalMinutes: number; count: number }>();
    TIMESHEET_CATEGORIES.forEach((c) => {
      catMap.set(c.value, { totalMinutes: 0, count: 0 });
    });

    monthEntries.forEach((e) => {
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
        percentage:
          monthMinutes > 0 ? Math.round((stats.totalMinutes / monthMinutes) * 100) : 0,
        count: stats.count,
      };
    });

    // 4. Project Breakdown
    const projMap = new Map<
      string,
      { id: string | null; name: string; key: string; totalMinutes: number }
    >();

    monthEntries.forEach((e) => {
      const pKey = e.projectId || "general";
      if (!projMap.has(pKey)) {
        projMap.set(pKey, {
          id: e.projectId,
          name: e.project?.name || "General / Internal",
          key: e.project?.key || "GEN",
          totalMinutes: 0,
        });
      }
      projMap.get(pKey)!.totalMinutes += e.durationMinutes;
    });

    const projectBreakdown = Array.from(projMap.values()).map((p) => ({
      projectId: p.id,
      projectName: p.name,
      projectKey: p.key,
      totalMinutes: p.totalMinutes,
      totalHours: Number((p.totalMinutes / 60).toFixed(1)),
      percentage:
        monthMinutes > 0 ? Math.round((p.totalMinutes / monthMinutes) * 100) : 0,
    }));

    // 5. Weekly Velocity (Mon - Sun of current week)
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weeklyVelocity = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = getLocalDateString(d);
      const daySlots = weekEntries.filter((e) => e.date === dStr);
      const dayMins = daySlots.reduce((sum, e) => sum + e.durationMinutes, 0);

      weeklyVelocity.push({
        date: dStr,
        dayName: dayNames[i],
        dayNumber: d.getDate(),
        isToday: dStr === todayStr,
        hours: Number((dayMins / 60).toFixed(1)),
        minutes: dayMins,
      });
    }

    // 6. Recent Activity (latest 6 slots)
    const recentActivity = monthEntries.slice(0, 6).map((e) => ({
      id: e.id,
      date: e.date,
      taskTitle: e.taskTitle,
      category: e.category,
      durationMinutes: e.durationMinutes,
      projectName: e.project?.name || null,
      projectKey: e.project?.key || null,
    }));

    // 7. Team Pulse (Aggregate velocity)
    const activeTeamUserIds = new Set<string>();
    teamWeekEntries.forEach((e) => activeTeamUserIds.add(e.userId));
    teamWeekCheckIns.forEach((c) => activeTeamUserIds.add(c.userId));

    const totalTeamMinutes = teamWeekEntries.reduce(
      (sum, e) => sum + e.durationMinutes,
      0
    );
    const totalTeamHoursThisWeek = Number((totalTeamMinutes / 60).toFixed(1));
    const activeCount = Math.max(1, activeTeamUserIds.size);
    const avgHoursPerMember = Number((totalTeamHoursThisWeek / activeCount).toFixed(1));

    // Top category this week across team
    const teamCatCounts: Record<string, number> = {};
    teamWeekEntries.forEach((e) => {
      teamCatCounts[e.category] =
        (teamCatCounts[e.category] || 0) + e.durationMinutes;
    });
    let topCat = "TASK";
    let maxCatMinutes = 0;
    for (const [cat, mins] of Object.entries(teamCatCounts)) {
      if (mins > maxCatMinutes) {
        maxCatMinutes = mins;
        topCat = cat;
      }
    }
    const topCatObj = TIMESHEET_CATEGORIES.find((c) => c.value === topCat);

    const result: MemberProgressData = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      targets: {
        todayMinutes,
        todayTargetMinutes,
        todayPercent,
        weekMinutes,
        weekTargetMinutes,
        weekPercent,
        monthMinutes,
        monthTargetMinutes,
        monthPercent,
      },
      attendance: {
        checkedInDaysThisMonth: checkInDatesSet.size,
        totalMonthWorkingDays: workingDaysCount,
        attendancePercent,
        todayCheckedIn: Boolean(todayCheckIn),
        todayCheckInTime: todayCheckIn?.checkInTime
          ? todayCheckIn.checkInTime.toISOString()
          : null,
        todayCheckOutTime: todayCheckIn?.checkOutTime
          ? todayCheckIn.checkOutTime.toISOString()
          : null,
        todayDurationMinutes,
      },
      categoryBreakdown,
      projectBreakdown,
      weeklyVelocity,
      recentActivity,
      teamPulse: {
        activeMembersThisWeek: activeTeamUserIds.size,
        totalTeamHoursThisWeek,
        avgHoursPerMember,
        topCategoryThisWeek: topCatObj?.label || "Task",
      },
    };

    return { success: true, data: result };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to load progress analytics";
    return { success: false, error: message };
  }
}
