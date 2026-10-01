export const TIMESHEET_CATEGORIES = [
  {
    value: "TASK",
    label: "Task",
    color: "#2563EB",
    bgSoft: "rgba(37, 99, 235, 0.12)",
    border: "rgba(37, 99, 235, 0.28)",
    badgeClass: "cat-task",
    description: "Standard development, implementation, or design work",
  },
  {
    value: "DEFECT",
    label: "Defect",
    color: "#DC2626",
    bgSoft: "rgba(220, 38, 38, 0.12)",
    border: "rgba(220, 38, 38, 0.28)",
    badgeClass: "cat-defect",
    description: "Bug fixes, defect remediation, and patch testing",
  },
  {
    value: "FEATURE_REQUEST",
    label: "Feature Request",
    color: "#7C3AED",
    bgSoft: "rgba(124, 58, 237, 0.12)",
    border: "rgba(124, 58, 237, 0.28)",
    badgeClass: "cat-feature",
    description: "New feature engineering and capability rollout",
  },
  {
    value: "CHANGE_REQUEST",
    label: "Change Request",
    color: "#D97706",
    bgSoft: "rgba(217, 119, 6, 0.12)",
    border: "rgba(217, 119, 6, 0.28)",
    badgeClass: "cat-change",
    description: "Scope modification, requirement adjustment, or enhancements",
  },
  {
    value: "APPLICATION_SUPPORT",
    label: "Application Support",
    color: "#0891B2",
    bgSoft: "rgba(8, 145, 178, 0.12)",
    border: "rgba(8, 145, 178, 0.28)",
    badgeClass: "cat-support",
    description: "Production triage, operational support, and client queries",
  },
  {
    value: "MEETING",
    label: "Meeting",
    color: "#059669",
    bgSoft: "rgba(5, 150, 105, 0.12)",
    border: "rgba(5, 150, 105, 0.28)",
    badgeClass: "cat-meeting",
    description: "Daily standup, sprint ceremonies, client reviews, 1-on-1s",
  },
  {
    value: "COMPANY_ACTIVITIES",
    label: "Company Activities",
    color: "#DB2777",
    bgSoft: "rgba(219, 39, 119, 0.12)",
    border: "rgba(219, 39, 119, 0.28)",
    badgeClass: "cat-company",
    description: "All-hands meetings, town halls, team building, culture drives",
  },
  {
    value: "ORG_ACTIVITIES",
    label: "Org Activities",
    color: "#4F46E5",
    bgSoft: "rgba(79, 70, 229, 0.12)",
    border: "rgba(79, 70, 229, 0.28)",
    badgeClass: "cat-org",
    description: "Trainings, certifications, mentorship, hackathons, audit prep",
  },
] as const;

export type TimesheetCategoryValue =
  (typeof TIMESHEET_CATEGORIES)[number]["value"];

export const VALID_CATEGORIES = TIMESHEET_CATEGORIES.map((c) => c.value);

export function getCategoryMeta(category: string) {
  const match = TIMESHEET_CATEGORIES.find(
    (c) => c.value === category || c.value.toLowerCase() === category.toLowerCase()
  );
  if (match) return match;
  return {
    value: category,
    label: category.replace(/_/g, " "),
    color: "#6B7280",
    bgSoft: "rgba(107, 114, 128, 0.12)",
    border: "rgba(107, 114, 128, 0.28)",
    badgeClass: "cat-generic",
    description: "General activity",
  };
}

export function formatMinutes(mins: number): string {
  if (mins <= 0) return "0m";
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours === 0) return `${remainingMins}m`;
  if (remainingMins === 0) return `${hours}h`;
  return `${hours}h ${remainingMins}m`;
}

export function formatTimeAmPm(isoOrTime: string | Date | null | undefined): string {
  if (!isoOrTime) return "—";
  if (typeof isoOrTime === "string" && /^\d{1,2}:\d{2}$/.test(isoOrTime)) {
    const [h, m] = isoOrTime.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
  }
  const date = new Date(isoOrTime);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
