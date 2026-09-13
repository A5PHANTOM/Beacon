import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { getStorageUsageEstimateAction } from "./actions";
import { UsageClient } from "./usage-client";

export default async function AdminUsagePage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/projects");
  }

  const res = await getStorageUsageEstimateAction();

  if (!res.success || !res.data) {
    return (
      <div style={{ maxWidth: 800, margin: "60px auto", padding: 24, textAlign: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
          Failed to load storage usage data
        </h2>
        <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 8 }}>
          {res.error || "An unexpected error occurred while calculating storage."}
        </p>
      </div>
    );
  }

  return <UsageClient initialData={res.data} />;
}
