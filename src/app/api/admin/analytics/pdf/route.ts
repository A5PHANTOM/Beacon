import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { getSystemAnalyticsData } from "@/app/(dashboard)/admin/analytics/actions";
import { generateAnalyticsPdfBuffer } from "@/lib/pdf/analytics-pdf";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerAuthSession();

    if (!session?.user) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (session.user.role !== "ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    const systemData = await getSystemAnalyticsData();

    let projectData;
    let filename = "beacon-system-analytics-report.pdf";

    if (projectId) {
      projectData = systemData.projects.find((p) => p.id === projectId || p.key.toUpperCase() === projectId.toUpperCase());
      if (projectData) {
        const safeKey = projectData.key.replace(/[^a-zA-Z0-9_-]/g, "");
        filename = `beacon-project-${safeKey}-analytics.pdf`;
      }
    }

    const adminName = session.user.name || session.user.email || "System Admin";
    const pdfBuffer = await generateAnalyticsPdfBuffer({
      systemData,
      projectData,
      generatedBy: adminName,
    });

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate PDF";
    return new NextResponse(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
