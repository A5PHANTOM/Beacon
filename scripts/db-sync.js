const { execSync } = require("child_process");

try {
  // If running in Vercel with Postgres, automatically synchronize schema tables
  const dbUrl =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    "";

  const isPostgres =
    dbUrl.startsWith("postgres://") ||
    dbUrl.startsWith("postgresql://") ||
    Boolean(process.env.POSTGRES_PRISMA_URL);

  if (Boolean(process.env.VERCEL) && isPostgres) {
    console.log("[db-sync] Synchronizing PostgreSQL tables on Vercel deployment...");
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: dbUrl,
      },
    });
    console.log("[db-sync] PostgreSQL tables synchronized successfully.");
  }
} catch (err) {
  console.warn("[db-sync] Database sync note:", err.message);
}
