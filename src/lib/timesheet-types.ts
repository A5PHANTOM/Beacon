import { z } from "zod";
import { VALID_CATEGORIES } from "./timesheet-constants";

export const createTaskSlotSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  taskTitle: z
    .string()
    .trim()
    .min(2, "Task title must be at least 2 characters")
    .max(160, "Task title must be at most 160 characters"),
  category: z.string().refine((val) => VALID_CATEGORIES.includes(val as any), {
    message: "Invalid category selected",
  }),
  durationMinutes: z
    .number()
    .int()
    .min(5, "Duration must be at least 5 minutes")
    .max(1440, "Duration cannot exceed 24 hours (1440 minutes)"),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time must be HH:MM")
    .optional()
    .or(z.literal("")),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "End time must be HH:MM")
    .optional()
    .or(z.literal("")),
  projectId: z.string().cuid().optional().or(z.literal("")),
  issueId: z.string().cuid().optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
});

export const updateTaskSlotSchema = createTaskSlotSchema.extend({
  id: z.string().cuid("Invalid entry identifier"),
});

export const deleteTaskSlotSchema = z.object({
  id: z.string().cuid("Invalid entry identifier"),
});

export const checkInSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  workLocation: z.enum(["OFFICE", "REMOTE", "HYBRID"]).default("OFFICE"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const checkOutSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const manualCheckInSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  checkInTime: z.string().min(1, "Check-in time is required"),
  checkOutTime: z.string().optional().or(z.literal("")),
  workLocation: z.enum(["OFFICE", "REMOTE", "HYBRID"]).default("OFFICE"),
  notes: z.string().max(500).optional().or(z.literal("")),
  status: z.enum(["PRESENT", "HALF_DAY", "ON_LEAVE"]).default("PRESENT"),
});

export type CreateTaskSlotInput = z.infer<typeof createTaskSlotSchema>;
export type UpdateTaskSlotInput = z.infer<typeof updateTaskSlotSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type ManualCheckInInput = z.infer<typeof manualCheckInSchema>;

export type TaskSlotDto = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  projectId: string | null;
  projectName: string | null;
  projectKey: string | null;
  issueId: string | null;
  issueNumber: number | null;
  issueTitle: string | null;
  date: string; // YYYY-MM-DD
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  category: string;
  taskTitle: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DailyCheckInDto = {
  id: string;
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  checkInTime: string; // ISO string
  checkOutTime: string | null; // ISO string
  workLocation: string | null;
  notes: string | null;
  status: string;
  durationMinutes?: number;
};

export type DayCalendarData = {
  date: string; // YYYY-MM-DD
  isToday: boolean;
  checkIn: DailyCheckInDto | null;
  entries: TaskSlotDto[];
  totalDurationMinutes: number;
};

export type WeekDaySummary = {
  date: string; // YYYY-MM-DD
  dayName: string; // "Mon", "Tue"
  dayNumber: number;
  isToday: boolean;
  checkIn: DailyCheckInDto | null;
  entries: TaskSlotDto[];
  totalMinutes: number;
};

export type MonthDayCell = {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasCheckIn: boolean;
  checkInTimeFormatted?: string | null;
  totalMinutes: number;
  entryCount: number;
  categoryBadges: { category: string; count: number; color: string }[];
  entries: TaskSlotDto[];
};

export type CalendarViewData = {
  view: "day" | "week" | "month";
  currentDate: string; // YYYY-MM-DD
  displayRangeLabel: string;
  // Day view specific
  dayData?: DayCalendarData;
  // Week view specific
  weekDays?: WeekDaySummary[];
  weekTotalMinutes?: number;
  // Month view specific
  monthDays?: MonthDayCell[];
  monthTotalMinutes?: number;
  // Shared today's checkin for quick bar
  todayCheckIn: DailyCheckInDto | null;
  todayTotalMinutes: number;
  categorySummary: {
    category: string;
    label: string;
    color: string;
    totalMinutes: number;
    count: number;
    percentage: number;
  }[];
  accessibleProjects: { id: string; name: string; key: string }[];
};

export type AdminTimesheetReportData = {
  filterRange: {
    startDate: string;
    endDate: string;
    preset: string;
  };
  metrics: {
    totalHoursLogged: number;
    totalTaskSlots: number;
    activeMembersCount: number;
    totalCheckInsRecorded: number;
    avgDailyHoursPerMember: number;
    onTimeCheckInPercentage: number;
  };
  categoryBreakdown: {
    category: string;
    label: string;
    color: string;
    totalMinutes: number;
    totalHours: number;
    percentage: number;
    slotsCount: number;
  }[];
  memberSummaries: {
    userId: string;
    name: string;
    email: string;
    role: string;
    daysCheckedIn: number;
    totalHoursLogged: number;
    avgCheckInTime: string | null;
    categoryHours: Record<string, number>;
  }[];
  recentEntries: TaskSlotDto[];
  dailyCheckInLogs: DailyCheckInDto[];
  allMembers: { id: string; name: string; email: string }[];
  allProjects: { id: string; name: string; key: string }[];
};
