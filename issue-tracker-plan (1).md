# Beacon — Internal Issue Tracker — Final Build Plan

## 1. Evaluation of the current draft

What's already solid:
- Role model (Admin/Lead/Dev/QA/Viewer) is reasonable and scoped per project.
- Severity vs. priority distinction is correctly separated — a common miss in first drafts.
- Core data model (issue fields, comments, history, attachments) covers the basics.
- MVP vs Phase 2 split is a sane way to sequence work.
- Stack choice (React/Tailwind, Node or Django, Postgres, S3) is proven and fast to build with.

What's missing or thin:
- No build **timeline or milestones** — "MVP" and "Phase 2" aren't broken into buildable chunks.
- No **schema sketch** — field lists aren't the same as table relationships/keys.
- No **API design** (REST shape, pagination, filtering).
- No **workflow customization** — every team eventually wants project-specific statuses.
- No **issue relationships** beyond "duplicate detection" in Phase 2 (blocks/relates-to/child-of).
- No **bulk actions** (bulk assign/close/relabel) — painful to live without once volume grows.
- No **import/export** (CSV export, migrating existing bugs from a spreadsheet or Jira).
- No **non-functional requirements**: backups, rate limiting, file-upload limits/scanning, accessibility.
- No **testing strategy for the tracker itself**.
- No **onboarding/invite flow** for new users joining a project.
- No **cost/effort estimate** to sanity-check "is this worth building" beyond the initial gut-check.

The plan below folds all of this in without bloating the MVP — most additions land in Phase 2/3 or as a data-model afterthought that's cheap to include now and expensive to retrofit later (e.g., issue linking, audit history).

---

## 2. Roles & permissions (unchanged, confirmed good)

| Role | Can do |
|---|---|
| Admin | Manage users, all projects, global settings |
| Project Lead | Create projects, add/remove members, view reports, edit workflow |
| Developer | View assigned issues, change status, comment, mark fixed |
| Tester/QA | Raise issues, verify fixes, reopen |
| Viewer (optional) | Read-only |

Access scoped per project. Add one more rule up front: **only Admin or Project Lead can delete an issue** (others can only close/reopen) — prevents accidental data loss becoming a recurring support ticket.

---

## 3. Data model (schema-level, not just field list)

Core tables and how they relate:

- **users** (id, name, email, password_hash, role, created_at)
- **projects** (id, name, key, description, created_by)
- **project_members** (project_id, user_id, role_in_project)
- **issues** (id, project_id, title, description, steps_to_reproduce, expected, actual, severity, priority, status, reporter_id, assignee_id, environment, created_at, updated_at)
- **issue_links** (issue_id, linked_issue_id, link_type: duplicate | blocks | relates_to | child_of) — *build this into the MVP schema even if the UI for it ships in Phase 2; retrofitting a relations table onto live issue data is annoying*
- **comments** (id, issue_id, user_id, body, created_at)
- **attachments** (id, issue_id, uploaded_by, file_url, filename, size, uploaded_at)
- **issue_history** (id, issue_id, user_id, field_changed, old_value, new_value, changed_at) — this is your audit log; feed it from a single backend write-path, not from every endpoint individually
- **notifications** (id, user_id, issue_id, type, read_at)

Keep `status` and `severity`/`priority` as enums at the database level to start; move to a per-project configurable table (see §6) once a team actually asks for custom statuses.

---

## 4. Severity vs. priority (unchanged — this was right)

| Level | Severity (technical impact) | Typical priority |
|---|---|---|
| Low | Cosmetic, no functional impact | Fix whenever, batch it |
| Medium | Feature partly broken, workaround exists | Fix this sprint |
| High | Major feature broken, no workaround | Fix before next release |
| Critical | Crash, data loss, security hole, blocks release | Fix now |

Color-coded badge (green → yellow → orange → red) in list/board views.

---

## 5. Issue workflow

Reported → Triaged → In Progress → Fixed (awaiting verification) → Verified/Closed
                                        ↑______________________|
                                   Reopened if verification fails

The reopen loop from Verification back to In Progress is the part that's easy to skip in v1 and painful to bolt on later — build it into the MVP.

---

## 6. MVP (build this first)

1. Auth + role-based access, scoped per project
2. Create/browse/filter issues (status, severity, assignee, project)
3. List view + Kanban board
4. Assign, change status, comment thread
5. File attachments (size-limited, e.g. 10MB/file, 5 files/issue to start)
6. Notifications on assignment/status change/new comment (email, in-app inbox)
7. Search (title/description, basic filters)
8. Issue history/audit trail (write-path centralized, per §3)
9. Basic issue linking schema present (UI can lag, see §3)

**Suggested milestone breakdown (rough, adjust to team size):**

| Milestone | Scope |
|---|---|
| M1 (Weeks 1–2) | Auth, roles, project CRUD, DB schema |
| M2 (Weeks 3–4) | Issue CRUD, list view, filters |
| M3 (Weeks 5–6) | Kanban board, status workflow, comments |
| M4 (Weeks 7–8) | Attachments, notifications, search |
| M5 (Week 9) | Internal dogfooding + bug-fixing on the tracker itself |

---

## 7. Phase 2 (once MVP is in daily use)

- Dashboards: open vs closed trend, avg time-to-resolve, workload per developer
- SLA rules (e.g., Critical issues need first response within 4 hours)
- Slack/Teams/email integration
- Link issues to a release/sprint
- Duplicate-issue detection (surfaced via the `issue_links` table from §3)
- Custom fields/labels per project
- Bulk actions: bulk assign, bulk status change, bulk relabel
- CSV export (and a basic CSV/Jira import path — teams migrating in will ask for this immediately)
- Per-project configurable statuses/workflow (move status out of a hardcoded enum)

## 8. Phase 3 (nice-to-have, only if the tool sticks)

- Time tracking/estimation
- WebSocket live board updates
- Mobile-responsive polish / native app
- Full-text search (Postgres `tsvector` or Elasticsearch if volume justifies it)

---

## 9. Non-functional requirements (bake in from day one)

- **Security**: bcrypt/argon2 password hashing, HTTPS everywhere, role checks enforced server-side (never just hidden UI), rate limiting on auth endpoints.
- **File uploads**: size caps, allowed-type whitelist, virus/malware scan if this is exposed beyond a trusted internal network.
- **Backups**: automated daily Postgres backups + tested restore process — untested backups aren't backups.
- **Accessibility**: keyboard navigation and contrast-compliant badges, since the severity color-coding needs a non-color fallback (icon or text label) for colorblind users.
- **Testing**: unit tests on the backend (status transitions, permission checks especially), integration tests on the core issue-create → assign → resolve flow.

---

## 10. Suggested stack (unchanged, confirmed reasonable)

- Frontend: React + Tailwind
- Backend: Node/Express or Django — either fine at this scale
- Database: PostgreSQL
- Auth: JWT sessions, or Auth0/Clerk to skip building login from scratch
- File storage: S3-compatible bucket
- Hosting: Render/Railway/Fly.io for a small team; AWS/GCP/Azure if SSO or scale is likely
- API: REST, versioned (`/api/v1/...`), paginated list endpoints (`?page=&limit=&status=&severity=&assignee=`)

---

## 11. Before you start building

Quick gut-check, worth revisiting: Jira, Linear, GitHub Issues, Redmine, and YouTrack already cover most of this out of the box. Build custom if you specifically want full data ownership, no per-seat licensing, a workflow these tools genuinely don't fit, or you just want to own the whole stack. If any of those apply, this plan is ready to build against.
