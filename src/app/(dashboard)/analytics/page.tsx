import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { getMemberProgressAction } from "./actions";
import { SimpleAnalyticsDashboard } from "@/components/analytics/simple-analytics-dashboard";

export const metadata = {
  title: "Progress & Analytics | Beacon",
  description: "Track work hours, velocity, targets, and team momentum",
};

export default async function AnalyticsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  const result = await getMemberProgressAction();

  if (!result.success || !result.data) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <h2 className="text-base font-bold text-[var(--crit)]">
          Failed to load analytics
        </h2>
        <p className="text-xs text-[var(--text-dim)] mt-1">
          {result.error || "Please refresh the page."}
        </p>
      </div>
    );
  }

  return <SimpleAnalyticsDashboard data={result.data} />;
}
