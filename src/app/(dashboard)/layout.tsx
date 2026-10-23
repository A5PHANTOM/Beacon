import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/navigation/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch accessible projects for the project switcher & cmdk
  let projects;
  if (session.user.role === "ADMIN") {
    projects = await prisma.project.findMany({
      select: { id: true, name: true, key: true },
      orderBy: { name: "asc" },
    });
  } else {
    projects = await prisma.project.findMany({
      where: {
        members: {
          some: { userId: session.user.id },
        },
      },
      select: { id: true, name: true, key: true },
      orderBy: { name: "asc" },
    });
  }

  return (
    <AppShell
      projects={projects}
      currentUser={{
        id: session.user.id,
        name: session.user.name || "User",
        email: session.user.email || "",
        role: session.user.role,
      }}
    >
      {children}
    </AppShell>
  );
}
