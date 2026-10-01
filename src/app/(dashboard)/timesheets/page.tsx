import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { getMemberCalendarDataAction } from "./actions";
import { TimesheetView } from "@/components/timesheets/timesheet-view";

export const metadata = {
  title: "Timesheets & Calendar | Beacon",
  description: "Track work duration, task slots, and attendance check-in",
};

export default async function TimesheetsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  const result = await getMemberCalendarDataAction("week");

  if (!result.success || !result.data) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-base font-bold text-[var(--crit)]">
          Failed to load timesheet data
        </h2>
        <p className="text-xs text-[var(--text-dim)] mt-1">
          {result.error || "Please refresh or contact your administrator."}
        </p>
      </div>
    );
  }

  return <TimesheetView initialData={result.data} />;
}
