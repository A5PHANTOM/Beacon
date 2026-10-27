# Beacon

Beacon is an internal project and issue tracker built with Next.js, NextAuth, and Prisma.

## Development

Install dependencies with `npm install`, copy `.env.example` to `.env`, and configure the database and authentication variables. The existing repository supports SQLite locally and PostgreSQL on Vercel. Run `npx prisma migrate deploy` for a new local SQLite database, then `npm run dev`. Run `npm run build` before deploying.

## GitHub login

GitHub sign-in is optional and sits alongside the existing Beacon password login. It requires a GitHub **OAuth App**; a repository token is not an OAuth client secret.

1. Open [GitHub OAuth app registration](https://github.com/settings/applications/new).
2. Name it **Beacon Local**. Set the homepage to `http://localhost:3000` and the authorization callback URL to `http://localhost:3000/api/auth/callback/github`.
3. Copy the Client ID and generate a client secret. Add these to your ignored local `.env` file:

   ```dotenv
   GITHUB_ID="your-client-id"
   GITHUB_SECRET="your-client-secret"
   NEXTAUTH_URL="http://localhost:3000"
   ```

4. Apply local migrations with `npx prisma migrate deploy`, then restart `npm run dev`.
5. Open `http://localhost:3000/login` and select **Continue with GitHub**. Sign in on GitHub and authorize access to your profile and email addresses.

Until both OAuth variables are configured, the button shows that setup is required and password login continues to work. Keep the client secret out of Git, chat, screenshots, and browser code. For production, configure `GITHUB_ID`, `GITHUB_SECRET`, and `NEXTAUTH_URL` in Vercel’s Production environment. Set `NEXTAUTH_URL` to `https://beacon-a5phantom.vercel.app` and register `https://beacon-a5phantom.vercel.app/api/auth/callback/github` as an allowed redirect URI in your OAuth app.

On the first GitHub login, one of the account's **verified** GitHub emails (including a private or secondary email) must match exactly one existing Beacon account. Unknown accounts are denied rather than registered automatically. A conflicting link or multiple matching Beacon accounts is also denied. Subsequent logins use the stored GitHub numeric ID, so username or email changes do not transfer the link to another Beacon user. The username is refreshed on successful login; Beacon roles, project membership, and passwords remain unchanged. OAuth access tokens are used on the server during sign-in and are not stored or returned in the session.

The flow uses NextAuth's authorization-code flow with state and PKCE. Login does not grant repository permissions. Connected project assignee lists match verified GitHub IDs against the repository’s current assignable users.

Run `npm run test:github-login` for tests against a temporary SQLite database and stubbed GitHub responses. A real end-to-end OAuth test requires your local OAuth app credentials.

## GitHub Issues connection

Set `GITHUB_TOKEN_ENCRYPTION_KEY` to a stable 32-byte hex key (`openssl rand -hex 32`). Back it up securely; changing it requires re-entering connected projects' GitHub tokens. Tokens are encrypted with AES-256-GCM and are never returned to the browser.

On a project page, developers, leads, and administrators can expand **GitHub Issues**, enter a repository owner/name and a fine-grained GitHub token with **Issues: Read and write**, and connect. The token must be authorized for the selected repository (including any organization approval). Issues must be enabled in that repository. Connection checks read access; missing write permission appears as a sync error on the first write. See [GitHub's issue API permissions](https://docs.github.com/en/rest/issues/issues).

New Beacon issues create GitHub issues. Title/body changes update the linked issue. `CLOSED` closes it; reopening in Beacon reopens it. Other Beacon statuses remain open on GitHub. For connected projects, the selected developer is assigned directly on GitHub. The developer must belong to the Beacon project, have signed in with GitHub, and be assignable in that repository. The GitHub description includes **Reported by** with the original Beacon reporter’s name, plus the current assignment and **Assigned by**. Assignment comments credit the Beacon user recorded in assignment history; retrying as another user does not change that attribution. Names are shown as text labels without exposing email addresses. GitHub’s native author badge remains the connected token owner. Existing issue descriptions receive these labels on their next sync. Close/reopen events can flow back after enabling GitHub updates. Other GitHub edits do not flow back.

**Sync pending** publishes existing issues and retries failed or stale syncs in batches of three. Local changes remain saved during GitHub outages. The project panel shows pending counts and errors, and linked issues have an **Open in GitHub** link after refresh. **Pause sync** retains links and the encrypted token; reconnect the same repository to resume or replace an expired token. A project's repository cannot be changed after connection, so existing issue numbers cannot accidentally target another repository.

Sync runs within authorized requests, with a durable per-issue lease and recovery markers to avoid duplicate issues/comments when an API response or local acknowledgement is lost. A busy issue stays pending for retry after its lease expires (five minutes). Recovery pagination is bounded; very large repositories or comment threads may need manual attention. There is no background worker; failed syncs require **Sync pending** or a subsequent issue update. GitHub is not contacted by the automated integration tests.

## Dynamic assignment and email changes

When GitHub sync is enabled, creation and reassignment pickers only offer **Beacon project developers ∩ linked GitHub identities ∩ repository-assignable users**. Testers, viewers, people from other Beacon projects, unlinked accounts, and users without repository access are excluded. Password-only developers can sign in with GitHub once to establish their verified identity. Matching uses the immutable GitHub ID, so email privacy and username changes do not affect eligibility.

The list refreshes on opening assignment controls, returning focus to Beacon, or clicking **Refresh developers**. All pages of the GitHub list are read (with a safety limit); incomplete lists and failed lookups fail closed. Both create and reassignment actions validate the choice again on the server, so an old browser list cannot bypass removed access. Projects with no active GitHub connection retain local developer assignment.

A sync is complete only after GitHub returns the requested assignee. Silent rejection, expired tokens, rate limits, and outages produce a visible pending warning and can be retried from the connection panel. Local changes remain saved when the remote write fails. Clearing the Beacon assignee also clears GitHub assignees. Title/status updates can still sync when an older issue has an ineligible assignee, while assignment stays pending. Concurrent edits use an optimistic check and atomic history writes; concurrent creates retry project-number collisions. A sync lease protects against duplicate remote creation, and a newer edit remains pending until that revision is synced.

In **Admin → Team & Users**, **Reset Email** changes the sign-in email for developers, testers, and other accounts. The server requires admin access, normalizes and validates email, checks uniqueness, and rejects stale updates. Email changes end existing sessions, clear the verified GitHub link, and flag affected issue syncs for retry. Passwords, roles, project membership, and issue ownership stay the same. Existing **Edit** controls apply the same protections when changing an email. Changing your own email signs you out so you can sign in with the new address.

`npm run test:assignment-email` runs 49 cases with real Prisma transactions against an isolated SQLite database and a stubbed GitHub API. See [the test-case report](scripts/assignment-email-test-cases.md). These tests do not post issues or comments to a live repository.

## GitHub → Beacon status updates

On the **deployed project page → GitHub Issues → Settings**, select **Enable GitHub updates**. The project token needs **Webhooks: Read and write** as well as **Issues: Read and write**, and its GitHub account must be allowed to manage repository webhooks. If needed, update the token in the same panel, save it, then enable incoming updates. Setup requires a publicly reachable HTTPS `NEXTAUTH_URL`; GitHub cannot deliver to localhost.

Beacon configures a repository webhook at `/api/github/webhooks/[projectId]` with a separate random signing secret for that project, encrypted with the existing `GITHUB_TOKEN_ENCRYPTION_KEY`. No new environment variable or manual secret copying is required. Repeating setup updates the matching hook and preserves its secret. It does not modify unrelated repository hooks.

Only saved issue links are accepted. A GitHub reopen moves `CLOSED`, `FIXED`, or `VERIFIED` back to `IN_PROGRESS`. Active pipeline states are preserved when GitHub echoes an outgoing open request. A GitHub close moves an issue to `CLOSED` only if Beacon’s existing workflow permits that transition. GitHub users must have a linked Beacon identity and permission to update that project; unknown users, viewers, and outsiders cannot bypass Beacon permissions. The sender is credited in issue history, with a comment identifying the GitHub event.

The project refreshes visible issue statuses every 15 seconds and on window focus when incoming updates are enabled. Setup subscribes to future close/reopen events; changes that happened before setup need a new GitHub event (for example, close and reopen once). Titles, descriptions, assignments, comments, and newly created GitHub issues are not imported. Pausing the project connection ignores incoming changes.

Payloads are checked using the raw-body HMAC-SHA256 signature, repository identity, webhook ID, delivery UUID, linked issue number, and immutable remote issue ID. Persisted delivery receipts prevent duplicate history and keep events that arrive during an outgoing sync. The current GitHub issue is fetched before applying a change, so a stale event cannot overwrite the current remote state. Pending local status changes take precedence until outbound sync completes. The receiver never writes back to GitHub, preventing sync loops.

Use **Retry incoming** for accepted updates that could not finish. Outgoing sync also drains queued events after releasing its issue lock. Requests are bounded and state is persisted in Postgres rather than an in-memory worker. GitHub does not automatically redeliver failed HTTP deliveries; repository webhook settings also provide manual redelivery. See [GitHub delivery guidance](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries).

Run `npm run test:github-webhooks` for signature, replay, permissions, workflow, concurrency, and recovery tests against real Prisma transactions with a simulated GitHub API. See [the webhook test-case report](scripts/github-webhook-test-cases.md).

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
