# Beacon

Beacon is an internal project and issue tracker built with Next.js, NextAuth, and Prisma.

## Development

Install dependencies with `npm install`, copy `.env.example` to `.env`, and configure the database and authentication variables. The existing repository supports SQLite locally and PostgreSQL on Vercel. Run `npx prisma migrate deploy` for a new local SQLite database, then `npm run dev`. Run `npm run build` before deploying.

## GitHub Issues connection

Set `GITHUB_TOKEN_ENCRYPTION_KEY` to a stable 32-byte hex key (`openssl rand -hex 32`). Back it up securely; changing it requires re-entering connected projects' GitHub tokens. Tokens are encrypted with AES-256-GCM and are never returned to the browser.

On a project page, developers, leads, and administrators can expand **GitHub Issues**, enter a repository owner/name and a fine-grained GitHub token with **Issues: Read and write**, and connect. The token must be authorized for the selected repository (including any organization approval). Issues must be enabled in that repository. Connection checks read access; missing write permission appears as a sync error on the first write. See [GitHub's issue API permissions](https://docs.github.com/en/rest/issues/issues).

New Beacon issues create GitHub issues. Title/body changes update the linked issue. `CLOSED` closes it; reopening in Beacon reopens it. Other Beacon statuses remain open on GitHub. The assigned Beacon person's name is posted as a comment on initial creation and whenever the assignment changes; no GitHub username mapping is required. GitHub changes do not flow back to Beacon.

**Sync pending** publishes existing issues and retries failed or stale syncs in batches of three. Local changes remain saved during GitHub outages. The project panel shows pending counts and errors, and linked issues have an **Open in GitHub** link after refresh. **Pause sync** retains links and the encrypted token; reconnect the same repository to resume or replace an expired token. A project's repository cannot be changed after connection, so existing issue numbers cannot accidentally target another repository.

Sync runs within authorized requests, with a durable per-issue lease and recovery markers to avoid duplicate issues/comments when an API response or local acknowledgement is lost. A busy issue stays pending for retry after its lease expires (five minutes). Recovery pagination is bounded; very large repositories or comment threads may need manual attention. There is no background worker; failed syncs require **Sync pending** or a subsequent issue update. GitHub is not contacted by the automated integration tests.

## Database migrations

The repository previously used schema pushes without a migration history. Reviewed baseline and GitHub migrations are included for SQLite (`prisma/migrations`) and PostgreSQL (`prisma/postgresql/migrations`). `scripts/prepare-prisma.js` refreshes the PostgreSQL schema snapshot. The Vercel build now applies PostgreSQL migrations and stops if they fail, instead of pushing schema with data-loss acceptance.

**Existing databases:** back up the database and verify it matches the pre-GitHub baseline. The Vercel build automatically marks the baseline only when Prisma confirms an exact match and no migration history exists; schema drift or inspection errors stop deployment before any baseline write. For manual/local setup, mark that baseline as applied once before applying the GitHub migration. Do not mark the GitHub migration as applied; it must create its tables. Do not reset a database to resolve drift.

SQLite, after configuring `DATABASE_URL` in `.env`:

```sh
npx prisma migrate resolve --applied 20261027102200_baseline
npx prisma migrate deploy
```

PostgreSQL, with the intended `DATABASE_URL` exported in your shell:

```sh
node scripts/prepare-prisma.js
npx prisma migrate resolve --schema prisma/postgresql/schema.prisma --applied 20261027102200_baseline
npx prisma migrate deploy --schema prisma/postgresql/schema.prisma
```

For a new PostgreSQL database, skip `migrate resolve` and use `migrate deploy` with the PostgreSQL schema. Production should use a pooled runtime URL; `POSTGRES_URL_NON_POOLING` can supply the direct migration URL during Vercel builds. Local SQLite migrations were generated and applied using `prisma migrate dev` against an isolated database. PostgreSQL SQL was generated with Prisma's schema diff; applying it requires a configured PostgreSQL instance.

## Validation

`node scripts/test-github-sync.cjs` migrates a temporary SQLite database and tests real server actions with a stubbed GitHub API: wrong-role/wrong-project access, input validation, encrypted tokens, issue creation, closure/reopening, assignment comments, audit history, outage/retry, duplicate recovery, and pause. It does not modify `prisma/dev.db`.

`node scripts/test-db-sync.cjs` checks safe adoption of the old schema, refusal to baseline drift, and migration behavior for new and managed databases.

The optional MCP API requires an explicitly configured `BEACON_API_KEY`; requests fail closed when it is unset. Status changes through MCP also sync to GitHub after the actor's project permission check.
