const { execFileSync } = require("child_process");

// Apply reviewed migrations only. Never push schema or accept data loss.
async function syncDatabase({ env = process.env, exec = execFileSync, Client, log = console.log } = {}) {
  const dbUrl = env.POSTGRES_URL_NON_POOLING || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL || env.DATABASE_URL || "";
  const isPostgres = dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");
  if (!env.VERCEL || !isPostgres) return;
  const PrismaClient = Client || require("@prisma/client").PrismaClient;
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  const cli = require.resolve("prisma/build/index.js");
  const schema = "prisma/postgresql/schema.prisma";
  const options = { stdio: "inherit", env: { ...env, DATABASE_URL: dbUrl } };
  const run = (args, opts = options) => exec(process.execPath, [cli, ...args], opts);
  try {
    const [tables] = await prisma.$queryRaw`
      SELECT to_regclass('public."Project"')::text AS project,
             to_regclass('public."_prisma_migrations"')::text AS migrations
    `;
    const history = tables.migrations
      ? await prisma.$queryRaw`SELECT migration_name FROM "_prisma_migrations" LIMIT 1`
      : [];
    if (tables.project && history.length === 0) {
      // Previous Beacon versions used db push. Mark the baseline only after Prisma
      // verifies the entire existing schema, including constraints and indexes.
      // Diff exit code 2 (drift) or any connection error must prevent all writes.
      try {
        run(["migrate", "diff", "--from-schema-datasource", schema, "--to-schema-datamodel", "prisma/postgresql/baseline.prisma", "--exit-code"], { ...options, stdio: "pipe" });
      } catch {
        throw new Error("Existing database does not match the reviewed Beacon baseline, or could not be inspected. No baseline was marked. Review the schema before deploying.");
      }
      log("[db-sync] Existing database matches the reviewed baseline; recording migration history.");
      run(["migrate", "resolve", "--schema", schema, "--applied", "20261027102200_baseline"]);
    }
  } finally {
    await prisma.$disconnect();
  }
  run(["migrate", "deploy", "--schema", schema]);
}

module.exports = { syncDatabase };
if (require.main === module) {
  syncDatabase().catch(error => {
    console.error("[db-sync] Migration failed:", error.message);
    process.exitCode = 1;
  });
}
