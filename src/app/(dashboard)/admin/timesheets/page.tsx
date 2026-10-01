import { redirect } from "next/navigation";
import { getServerAuthSession, requireAdmin } from "@/lib/auth";
import { getAdminTimesheetReportsAction } from "./actions";
import { AdminTimesheetReports } from "@/components/timesheets/admin-timesheet-reports";

export const metadata = {
  title: "Timesheet Reports & Attendance | Beacon Admin",
  description: "Comprehensive member hours, daily check-in logs, and 8-category task allocation reports",
};

export default async function AdminTimesheetsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/timesheets");
  }

  const result = await getAdminTimesheetReportsAction({ preset: "this_month" });

  if (!result.success || !result.data) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-base font-bold text-[var(--crit)]">
          Failed to load timesheet reports
        </h2>
        <p className="text-xs text-[var(--text-dim)] mt-1">
          {result.error || "Please refresh or contact your administrator."}
        </p>
      </div>
    );
  }

  return <AdminTimesheetReports initialData={result.data} />;
}
