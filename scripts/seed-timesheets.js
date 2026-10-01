const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Beacon database with timesheet data...");

  const passwordHash = await bcrypt.hash("1234", 10);

  // 1. Ensure users exist
  const admin = await prisma.user.upsert({
    where: { email: "admin@gmail.com" },
    update: { passwordHash, role: "ADMIN", name: "System Admin" },
    create: { email: "admin@gmail.com", name: "System Admin", passwordHash, role: "ADMIN" },
  });

  const developer = await prisma.user.upsert({
    where: { email: "dev@beacon.local" },
    update: { passwordHash, role: "MEMBER", name: "Alex Mercer" },
    create: { email: "dev@beacon.local", name: "Alex Mercer", passwordHash, role: "MEMBER" },
  });

  const tester = await prisma.user.upsert({
    where: { email: "tester@beacon.local" },
    update: { passwordHash, role: "MEMBER", name: "Maya Chen" },
    create: { email: "tester@beacon.local", name: "Maya Chen", passwordHash, role: "MEMBER" },
  });

  // 2. Ensure projects exist
  const bcnProject = await prisma.project.upsert({
    where: { key: "BCN" },
    update: {},
    create: {
      name: "Beacon Core",
      key: "BCN",
      description: "Core issue tracking web platform and API services",
      createdById: admin.id,
    },
  });

  const mobProject = await prisma.project.upsert({
    where: { key: "MOB" },
    update: {},
    create: {
      name: "Mobile App",
      key: "MOB",
      description: "iOS & Android native client applications",
      createdById: admin.id,
    },
  });

  // Assign memberships
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: bcnProject.id, userId: admin.id } },
    update: { roleInProject: "LEAD" },
    create: { projectId: bcnProject.id, userId: admin.id, roleInProject: "LEAD" },
  });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: bcnProject.id, userId: developer.id } },
    update: { roleInProject: "DEVELOPER" },
    create: { projectId: bcnProject.id, userId: developer.id, roleInProject: "DEVELOPER" },
  });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: bcnProject.id, userId: tester.id } },
    update: { roleInProject: "QA" },
    create: { projectId: bcnProject.id, userId: tester.id, roleInProject: "QA" },
  });

  // 3. Seed Timesheet Entries & Daily Check-ins
  const existingTimesheets = await prisma.timesheetEntry.count();
  if (existingTimesheets === 0) {
    console.log("Seeding sample Timesheet entries & Check-ins...");

    const dates = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"];

    // Daily check-ins
    for (const dStr of dates) {
      const [y, m, d] = dStr.split("-").map(Number);
      const isToday = dStr === "2026-10-01";

      await prisma.dailyCheckIn.upsert({
        where: { userId_date: { userId: developer.id, date: dStr } },
        update: {},
        create: {
          userId: developer.id,
          date: dStr,
          checkInTime: new Date(y, m - 1, d, 9, 15, 0),
          checkOutTime: isToday ? null : new Date(y, m - 1, d, 18, 0, 0),
          workLocation: d % 2 === 0 ? "OFFICE" : "REMOTE",
          status: "PRESENT",
          notes: isToday ? "Active in office" : "Completed sprint deliverables",
        },
      });

      await prisma.dailyCheckIn.upsert({
        where: { userId_date: { userId: tester.id, date: dStr } },
        update: {},
        create: {
          userId: tester.id,
          date: dStr,
          checkInTime: new Date(y, m - 1, d, 9, 5, 0),
          checkOutTime: new Date(y, m - 1, d, 17, 45, 0),
          workLocation: "OFFICE",
          status: "PRESENT",
        },
      });

      await prisma.dailyCheckIn.upsert({
        where: { userId_date: { userId: admin.id, date: dStr } },
        update: {},
        create: {
          userId: admin.id,
          date: dStr,
          checkInTime: new Date(y, m - 1, d, 8, 55, 0),
          checkOutTime: isToday ? null : new Date(y, m - 1, d, 18, 30, 0),
          workLocation: "OFFICE",
          status: "PRESENT",
          notes: "Management review",
        },
      });
    }

    // Sample Task Slots covering all 8 categories
    const sampleSlots = [
      {
        userId: developer.id,
        projectId: bcnProject.id,
        date: "2026-09-28",
        taskTitle: "Implement full calendar week and month views",
        category: "TASK",
        durationMinutes: 240, // 4 hours
        startTime: "09:30",
        endTime: "13:30",
        description: "Built the responsive 7-column grid and month day-cells with active badges.",
      },
      {
        userId: developer.id,
        projectId: bcnProject.id,
        date: "2026-09-28",
        taskTitle: "Weekly sprint planning and backlog grooming",
        category: "MEETING",
        durationMinutes: 90, // 1.5 hours
        startTime: "14:00",
        endTime: "15:30",
        description: "Reviewed Q4 milestones with product lead and engineering team.",
      },
      {
        userId: developer.id,
        projectId: bcnProject.id,
        date: "2026-09-28",
        taskTitle: "Investigate Postgres connection pooling leak",
        category: "DEFECT",
        durationMinutes: 120, // 2 hours
        startTime: "15:45",
        endTime: "17:45",
        description: "Identified unreleased Prisma client instances in edge handlers.",
      },
      {
        userId: developer.id,
        projectId: bcnProject.id,
        date: "2026-09-29",
        taskTitle: "OAuth 2.0 and JWT token refresh implementation",
        category: "FEATURE_REQUEST",
        durationMinutes: 210, // 3.5 hours
        startTime: "09:30",
        endTime: "13:00",
        description: "Added credentials provider fallback and cookie hardening.",
      },
      {
        userId: developer.id,
        projectId: mobProject.id,
        date: "2026-09-29",
        taskTitle: "Client support ticket: push notification delivery latency",
        category: "APPLICATION_SUPPORT",
        durationMinutes: 90, // 1.5 hours
        startTime: "14:00",
        endTime: "15:30",
        description: "Assisted DevOps team tracing APNs gateway timeouts.",
      },
      {
        userId: developer.id,
        projectId: null,
        date: "2026-09-29",
        taskTitle: "Beacon Engineering all-hands & quarterly townhall",
        category: "COMPANY_ACTIVITIES",
        durationMinutes: 120, // 2 hours
        startTime: "16:00",
        endTime: "18:00",
        description: "Company-wide vision presentation and culture engagement session.",
      },
      {
        userId: developer.id,
        projectId: bcnProject.id,
        date: "2026-09-30",
        taskTitle: "Adjust timesheet category schema to include Org Activities",
        category: "CHANGE_REQUEST",
        durationMinutes: 150, // 2.5 hours
        startTime: "09:30",
        endTime: "12:00",
        description: "Updated stakeholder specifications to include training and compliance tracking.",
      },
      {
        userId: developer.id,
        projectId: null,
        date: "2026-09-30",
        taskTitle: "SOC2 Compliance & Secure Coding Training",
        category: "ORG_ACTIVITIES",
        durationMinutes: 120, // 2 hours
        startTime: "13:30",
        endTime: "15:30",
        description: "Completed internal security certifications and dependency audit training.",
      },
      {
        userId: developer.id,
        projectId: bcnProject.id,
        date: "2026-10-01",
        taskTitle: "Daily standup meeting",
        category: "MEETING",
        durationMinutes: 30,
        startTime: "09:30",
        endTime: "10:00",
        description: "Shared updates on calendar integration and timesheet export.",
      },
      {
        userId: developer.id,
        projectId: bcnProject.id,
        date: "2026-10-01",
        taskTitle: "Build real-time check-in elapsed timer and attendance card",
        category: "TASK",
        durationMinutes: 240,
        startTime: "10:00",
        endTime: "14:00",
        description: "Created interactive Clock In / Clock Out components.",
      },
      // QA Tester Maya slots
      {
        userId: tester.id,
        projectId: bcnProject.id,
        date: "2026-09-28",
        taskTitle: "Verify defect remediation on attachment upload timeout",
        category: "DEFECT",
        durationMinutes: 180,
        description: "Simulated packet loss and validated retry banner UX.",
      },
      {
        userId: tester.id,
        projectId: bcnProject.id,
        date: "2026-09-29",
        taskTitle: "Feature testing: dark mode and theme synchronization",
        category: "FEATURE_REQUEST",
        durationMinutes: 240,
        description: "Verified all UI components in dark and light themes across Safari and Chrome.",
      },
      {
        userId: tester.id,
        projectId: bcnProject.id,
        date: "2026-09-30",
        taskTitle: "Support customer escalation triage",
        category: "APPLICATION_SUPPORT",
        durationMinutes: 120,
        description: "Logged reproduction steps for ticket #14.",
      },
      {
        userId: tester.id,
        projectId: null,
        date: "2026-10-01",
        taskTitle: "Internal QA knowledge sharing workshop",
        category: "ORG_ACTIVITIES",
        durationMinutes: 120,
        description: "Conducted testing framework demonstration for new hires.",
      },
      // Admin slots
      {
        userId: admin.id,
        projectId: bcnProject.id,
        date: "2026-09-28",
        taskTitle: "Executive steering committee & roadmap review",
        category: "MEETING",
        durationMinutes: 120,
        description: "Reviewed project analytics and SLA compliance.",
      },
      {
        userId: admin.id,
        projectId: null,
        date: "2026-09-29",
        taskTitle: "Company culture drive and quarterly awards",
        category: "COMPANY_ACTIVITIES",
        durationMinutes: 90,
        description: "Presented quarterly excellence badges to engineering teams.",
      },
      {
        userId: admin.id,
        projectId: bcnProject.id,
        date: "2026-10-01",
        taskTitle: "Admin timesheet reports & attendance review",
        category: "TASK",
        durationMinutes: 180,
        description: "Audited monthly hours allocation and category breakdown.",
      },
    ];

    for (const slot of sampleSlots) {
      await prisma.timesheetEntry.create({
        data: slot,
      });
    }

    console.log(`Successfully seeded ${sampleSlots.length} timesheet task slots and check-in records.`);
  } else {
    console.log(`Database already has ${existingTimesheets} timesheet entries.`);
  }

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
