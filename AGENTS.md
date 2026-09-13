# AGENTS.md — Beacon (Internal Issue Tracker)

This file tells any coding agent (Claude Code, Cursor, Codex, etc.) how to build, extend, and not break this project. Read this fully before writing code. The full product plan is in `issue-tracker-plan.md` in this repo — this file is the *how to build it correctly* companion.

Project name: **Beacon**. Use it consistently — repo name, `package.json` `name` field, page titles, README — don't leave placeholder names like "issue-tracker" or "my-app" in generated code.

---

## 0. Non-negotiables

- **No feature is "done" without server-side permission checks.** Hidden buttons are not access control. Every mutation checks the requester's role and project membership on the server, not just the client.
- **No raw SQL string concatenation, ever.** Use the ORM's parameterized queries.
- **Never trust client-provided IDs for ownership.** Always verify `project_id`/`user_id` against the session on the server before reading or writing.
- **Every DB write that changes an issue field must also write an `issue_history` row**, from one shared function — not duplicated per endpoint.
- **Don't invent scope.** If a feature isn't in the MVP list below, don't build it unless explicitly asked, even if it seems related.

---

## 1. Tech stack (locked in — do not substitute without being asked)

Chosen specifically so the whole thing deploys to Vercel with zero custom server config:

- **Framework**: Next.js (App Router), TypeScript, deployed as a single Vercel project
- **Database**: Postgres via Vercel Postgres or Neon — access through **Prisma**
- **Auth**: NextAuth.js (credentials provider + hashed passwords; email/OAuth can be added later)
- **File storage**: Vercel Blob (not local disk — Vercel's filesystem is ephemeral/read-only at runtime)
- **Styling/UI**: Tailwind CSS + shadcn/ui components
- **Email notifications**: Resend (has a generous free tier, integrates cleanly with Vercel)
- **Validation**: Zod on every API route input, shared between client and server
- **State/data fetching**: Server Components + Server Actions where possible; React Query only where client-side interactivity genuinely needs it (e.g. the Kanban board drag state)

Do **not** use: Express as a separate server, local filesystem writes, WebSocket servers (Vercel serverless functions don't hold persistent connections — if live board updates are requested later, use Pusher/Ably or Vercel's own realtime offering, not raw `ws`).

---

## 2. Repo structure

```
/app
  /(auth)/login, /register          — public routes
  /(dashboard)/projects/[id]        — main app, protected by middleware
  /(dashboard)/projects/[id]/issues/[issueId]
  /api/...                          — only for webhooks/third-party callbacks; prefer Server Actions for internal mutations
/components
  /ui                               — shadcn primitives, don't hand-edit generated ones
  /issues, /projects, /kanban       — feature components
/lib
  /db.ts                            — Prisma client singleton (see §5, connection pooling matters on serverless)
  /auth.ts                          — NextAuth config
  /permissions.ts                   — single source of truth for role checks, imported everywhere
  /history.ts                       — the one function that writes issue_history rows
/prisma
  /schema.prisma
  /migrations
```

If you're an agent about to create a new top-level folder, stop and check if it belongs under one of the above first.

---

## 3. Database schema

Base this directly on `prisma/schema.prisma`. Match the plan's schema exactly:

- `User`, `Project`, `ProjectMember` (join table with `roleInProject`)
- `Issue` (status/severity/priority as Prisma `enum`, not free-text strings)
- `IssueLink` (self-relation on `Issue`, `linkType` enum: `DUPLICATE | BLOCKS | RELATES_TO | CHILD_OF`) — **include this table in the first migration**, even before the UI for it exists. Retrofitting relations onto live rows is the thing to avoid.
- `Comment`, `Attachment`, `IssueHistory`, `Notification`

Run `prisma migrate dev` locally for every schema change — never hand-edit the database in production. Every migration must be committed alongside the code that needs it.

---

## 4. Core workflow logic (don't simplify this)

Status flow: `REPORTED → TRIAGED → IN_PROGRESS → FIXED → VERIFIED/CLOSED`, with a **reopen path** from `FIXED`/`VERIFIED` back to `IN_PROGRESS`. This loop is easy to leave out — it must be a first-class transition in the state machine, not a special case bolted on later.

Put the allowed-transitions table in one place (`/lib/workflow.ts`) as data, not scattered `if` statements across components — this is what makes per-project custom workflows (Phase 2) possible without a rewrite.

---

## 5. Vercel-specific gotchas (read before writing DB or file code)

- **Connection pooling**: serverless functions spin up per-request. Use Prisma's recommended pattern — a cached global client in dev, and Prisma Accelerate or PgBouncer (Vercel Postgres/Neon both provide pooled connection strings) in production. Without this, you WILL exhaust Postgres connections under load.
- **Cold starts**: keep API routes/Server Actions lean; don't do heavy work (e.g. image resizing) inline — offload to a background step or keep it minimal for MVP.
- **File uploads**: use Vercel Blob's client-upload pattern for anything over a few MB, so the file doesn't round-trip through the serverless function (which has body size limits, ~4.5MB on Vercel's default).
- **Environment variables**: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY` — document every one in `.env.example`, never commit real values.
- **No long-running processes.** No cron-in-a-loop, no in-memory job queues that assume the process stays alive — use Vercel Cron Jobs for scheduled tasks (e.g. SLA-breach checks in Phase 2).

---

## 6. Build order for the agent

Build and get a working, deployed increment at each step — don't write all models/pages in one giant pass with nothing runnable in between.

1. Next.js project scaffold + Prisma schema + first migration + deploy-to-Vercel smoke test (a blank page that queries the DB and renders something)
2. NextAuth + role model + project CRUD + membership
3. Issue CRUD + list view + filters (this is the first genuinely useful slice)
4. Kanban board + status workflow (including the reopen loop) + comments
5. Attachments via Vercel Blob + notifications via Resend + search
6. `issue_history` wired through every mutation path, verified by actually triggering changes and checking the table

At the end of each step: run `npm run build` and confirm it succeeds before moving on — catching a broken build at step 2 is cheap, at step 6 it isn't.

---

## 7. Error handling & reliability standards

- Every Server Action returns a typed result (`{ success: true, data } | { success: false, error }`) — never let an unhandled exception surface a raw stack trace to the client.
- Wrap all Prisma calls that can fail on bad input (foreign key violations, unique constraint violations) and return a clean user-facing message.
- Zod-validate every input at the boundary — Server Action, API route, and form submit — before it touches Prisma.
- Add a root `error.tsx` and `not-found.tsx` in the App Router so unhandled errors show a real page, not a crash screen.

---

## 8. Definition of done for any feature

A feature is complete only when:
- Server-side permission check is in place and tested against a wrong-role/wrong-project request
- `issue_history` is written for any field it changes
- Zod schema validates the input
- Loading and error states are handled in the UI (no infinite spinners, no silent failures)
- `npm run build` passes with no TypeScript errors

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
