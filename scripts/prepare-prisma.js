const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
if (!fs.existsSync(schemaPath)) {
  process.exit(0);
}

let schema = fs.readFileSync(schemaPath, "utf8");
const dbUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  "";

// If DATABASE_URL starts with postgres:// or postgresql://, or running in Vercel with Postgres, use postgresql
const isPostgres =
  dbUrl.startsWith("postgres://") ||
  dbUrl.startsWith("postgresql://") ||
  Boolean(process.env.POSTGRES_PRISMA_URL) ||
  Boolean(process.env.POSTGRES_URL_NON_POOLING) ||
  (Boolean(process.env.VERCEL) && !dbUrl.startsWith("file:"));

const targetProvider = isPostgres ? "postgresql" : "sqlite";

const currentMatch = schema.match(/provider\s*=\s*"(sqlite|postgresql)"/);
if (currentMatch && currentMatch[1] !== targetProvider) {
  schema = schema.replace(
    /provider\s*=\s*"(sqlite|postgresql)"/,
    `provider = "${targetProvider}"`
  );
  fs.writeFileSync(schemaPath, schema, "utf8");
  console.log(`[prepare-prisma] Updated schema.prisma provider to "${targetProvider}" (detected db: ${isPostgres ? "Postgres" : "SQLite"})`);
} else {
  console.log(`[prepare-prisma] schema.prisma already configured for "${targetProvider}"`);
}
