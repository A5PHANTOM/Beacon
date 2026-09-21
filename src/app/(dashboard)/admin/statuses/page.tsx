import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StatusesClient } from "./statuses-client";
import type { CustomStatusItem } from "./actions";

export default async function AdminStatusesPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/projects");
  }

  const [rawCustomStatuses, counts] = await Promise.all([
    prisma.customStatus.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    prisma.issue.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  const countMap = new Map<string, number>();
  counts.forEach((c) => {
    countMap.set(c.status, c._count.status);
  });

  const customStatuses: CustomStatusItem[] = rawCustomStatuses.map((s) => ({
    id: s.id,
    key: s.key,
    label: s.label,
    color: s.color,
    category: s.category as CustomStatusItem["category"],
    description: s.description,
    projectId: s.projectId,
    order: s.order,
    createdAt: s.createdAt.toISOString(),
    issuesCount: countMap.get(s.key) || 0,
  }));

  // Also pass system status usage counts
  const systemCounts: Record<string, number> = {};
  countMap.forEach((val, key) => {
    systemCounts[key] = val;
  });

  return (
    <StatusesClient
      initialCustomStatuses={customStatuses}
      systemCounts={systemCounts}
    />
  );
}
