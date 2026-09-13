import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Beacon database...");

  const passwordHash = await bcrypt.hash("1234", 10);

  // 1. Create or update Admin user
  const admin = await prisma.user.upsert({
    where: { email: "admin@gmail.com" },
    update: {
      passwordHash,
      role: "ADMIN",
      name: "System Admin",
    },
    create: {
      email: "admin@gmail.com",
      name: "System Admin",
      passwordHash,
      role: "ADMIN",
    },
  });

  // 2. Create sample Developer
  const developer = await prisma.user.upsert({
    where: { email: "dev@beacon.local" },
    update: {
      passwordHash,
      role: "MEMBER",
      name: "Alex Mercer",
    },
    create: {
      email: "dev@beacon.local",
      name: "Alex Mercer",
      passwordHash,
      role: "MEMBER",
    },
  });

  // 3. Create sample QA / Tester
  const tester = await prisma.user.upsert({
    where: { email: "tester@beacon.local" },
    update: {
      passwordHash,
      role: "MEMBER",
      name: "Maya Chen",
    },
    create: {
      email: "tester@beacon.local",
      name: "Maya Chen",
      passwordHash,
      role: "MEMBER",
    },
  });

  console.log("Users seeded:");
  console.log(" - Admin: admin@gmail.com / 1234");
  console.log(" - Developer: dev@beacon.local / 1234");
  console.log(" - Tester: tester@beacon.local / 1234");

  // 4. Create Projects
  const bcnProject = await prisma.project.upsert({
    where: { key: "BCN" },
    update: {
      name: "Beacon Core",
      description: "Core issue tracking web platform and API services",
      createdById: admin.id,
    },
    create: {
      name: "Beacon Core",
      key: "BCN",
      description: "Core issue tracking web platform and API services",
      createdById: admin.id,
    },
  });

  const mobProject = await prisma.project.upsert({
    where: { key: "MOB" },
    update: {
      name: "Mobile App",
      description: "iOS & Android native client applications",
      createdById: admin.id,
    },
    create: {
      name: "Mobile App",
      key: "MOB",
      description: "iOS & Android native client applications",
      createdById: admin.id,
    },
  });

  // 5. Assign Memberships
  // Beacon Core members:
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

  // Mobile App members:
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: mobProject.id, userId: admin.id } },
    update: { roleInProject: "LEAD" },
    create: { projectId: mobProject.id, userId: admin.id, roleInProject: "LEAD" },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: mobProject.id, userId: developer.id } },
    update: { roleInProject: "DEVELOPER" },
    create: { projectId: mobProject.id, userId: developer.id, roleInProject: "DEVELOPER" },
  });

  // 6. Create initial issues if none exist
  const existingCount = await prisma.issue.count({ where: { projectId: bcnProject.id } });
  if (existingCount === 0) {
    const issue1 = await prisma.issue.create({
      data: {
        projectId: bcnProject.id,
        number: 1,
        title: "Invoice preview locks after a failed payment",
        description: "Navigating back to invoice after stripe webhook error causes client exception.",
        stepsToReproduce: "1. Trigger card decline\n2. Return to invoice tab\n3. Click print preview",
        expected: "Invoice shows declined status banner with retry button",
        actual: "White screen of death with unhandled promise rejection",
        environment: "Production / Chrome 128",
        status: "REPORTED",
        severity: "HIGH",
        priority: "URGENT",
        reporterId: tester.id,
        assigneeId: developer.id,
      },
    });

    await prisma.issueHistory.create({
      data: {
        issueId: issue1.id,
        userId: tester.id,
        fieldChanged: "created",
        oldValue: null,
        newValue: "Issue created",
      },
    });

    const issue2 = await prisma.issue.create({
      data: {
        projectId: bcnProject.id,
        number: 2,
        title: "Search ignores quoted phrases in issue titles",
        description: "Typing 'failed payment' still matches individual terms with OR semantics instead of exact match.",
        stepsToReproduce: "1. Search \"payment error\"\n2. Observe issues matching only \"payment\"",
        expected: "Only issues containing exact sequence \"payment error\" returned",
        actual: "All issues with payment or error returned",
        environment: "Staging / Safari 18",
        status: "IN_PROGRESS",
        severity: "MEDIUM",
        priority: "HIGH",
        reporterId: tester.id,
        assigneeId: developer.id,
      },
    });

    await prisma.issueHistory.create({
      data: {
        issueId: issue2.id,
        userId: tester.id,
        fieldChanged: "created",
        oldValue: null,
        newValue: "Issue created",
      },
    });
    await prisma.issueHistory.create({
      data: {
        issueId: issue2.id,
        userId: developer.id,
        fieldChanged: "status",
        oldValue: "REPORTED",
        newValue: "IN_PROGRESS",
      },
    });

    await prisma.comment.create({
      data: {
        issueId: issue2.id,
        userId: developer.id,
        body: "Reproduced locally. Investigating SQLite FTS5 tokenizer behavior.",
      },
    });

    const issue3 = await prisma.issue.create({
      data: {
        projectId: bcnProject.id,
        number: 3,
        title: "Attachment upload does not show retry state",
        description: "When network drops during 5MB upload, spinner spins infinitely.",
        status: "FIXED",
        severity: "HIGH",
        priority: "HIGH",
        reporterId: tester.id,
        assigneeId: developer.id,
      },
    });

    await prisma.issueHistory.create({
      data: {
        issueId: issue3.id,
        userId: tester.id,
        fieldChanged: "created",
        oldValue: null,
        newValue: "Issue created",
      },
    });
    await prisma.issueHistory.create({
      data: {
        issueId: issue3.id,
        userId: developer.id,
        fieldChanged: "status",
        oldValue: "IN_PROGRESS",
        newValue: "FIXED",
      },
    });

    await prisma.comment.create({
      data: {
        issueId: issue3.id,
        userId: developer.id,
        body: "Fixed in commit 4b29f. Added axios interceptor retry timeout with banner. Ready for QA verification.",
      },
    });
  }

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
