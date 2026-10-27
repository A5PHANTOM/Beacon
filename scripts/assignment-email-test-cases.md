# Beacon assignment and email-reset test cases

Run: `npm run test:assignment-email`

Tested on 27 October 2026. GitHub responses are stubbed; Prisma transactions and migrations use a real, isolated SQLite database. No external GitHub issues/comments are created. These automated cases use SQLite; PostgreSQL migrations are applied separately during deployment.

| # | Test case | Result |
| --- | --- | --- |
| 1 | unconnected projects retain local developer assignment | PASS |
| 2 | only project managers can connect the repo | PASS |
| 3 | eligible list intersects linked Beacon developers and repository IDs | PASS |
| 4 | outsiders and anonymous callers cannot enumerate assignees | PASS |
| 5 | forged viewer and wrong-project mutations are rejected | PASS |
| 6 | pagination includes eligible developers beyond the first page | PASS |
| 7 | an unlinked or cross-project target cannot be assigned | PASS |
| 8 | stale choices are revalidated when repository access is removed | PASS |
| 9 | token failures fail closed without showing an unverified list | PASS |
| 10 | malformed GitHub data fails closed | PASS |
| 11 | invalid project input is rejected before external calls | PASS |
| 12 | a saved username without a verified GitHub ID cannot match another person | PASS |
| 13 | a truncated repository list is rejected rather than used partially | PASS |
| 14 | network exceptions fail closed without creating local issues | PASS |
| 15 | creation assigns the selected GitHub user and records history | PASS |
| 16 | GitHub descriptions credit the real tester and ignore a forged reporter ID | PASS |
| 17 | initial assignment comments credit the tester who raised the issue | PASS |
| 18 | retrying as an administrator preserves the original assignment actor | PASS |
| 19 | status updates retain the original reporter and current assignment actor | PASS |
| 20 | assignment history is credited even when a batch returns to the last synced person | PASS |
| 21 | attribution comments remain idempotent when another user retries recovery | PASS |
| 22 | names are escaped as labels rather than interpreted as GitHub Markdown | PASS |
| 23 | reassignment changes both systems and records the old developer | PASS |
| 24 | GitHub username changes are resolved by immutable account ID | PASS |
| 25 | clearing an assignee also clears GitHub assignment | PASS |
| 26 | silent GitHub assignment rejection remains pending and warns the user | PASS |
| 27 | an incomplete GitHub success response cannot mark assignment complete | PASS |
| 28 | viewers and outsiders cannot reassign existing issues | PASS |
| 29 | access lost between validation and sync is visible and retryable | PASS |
| 30 | a GitHub outage preserves local changes and closure can be retried | PASS |
| 31 | accepted creation with a lost response is recovered without duplicates | PASS |
| 32 | concurrent sync requests do not create duplicate issues or comments | PASS |
| 33 | concurrent edits fail safely and roll back their history | PASS |
| 34 | an edit during remote sync stays pending until the latest revision is synced | PASS |
| 35 | concurrent creates allocate distinct project issue numbers | PASS |
| 36 | email changes are denied to members and anonymous callers | PASS |
| 37 | email validation rejects malformed, duplicate, unchanged and stale values | PASS |
| 38 | email reset cannot inject roles or GitHub identities | PASS |
| 39 | resetting a tester email preserves password, role, and project access | PASS |
| 40 | email changes invalidate old sessions and the old password login email | PASS |
| 41 | the old GitHub identity cannot bypass an email reset | PASS |
| 42 | an email reset racing an OAuth callback cannot resurrect the old GitHub identity | PASS |
| 43 | developer email reset removes eligibility and flags linked issues for retry | PASS |
| 44 | the existing Edit user route applies the same identity reset protections | PASS |
| 45 | simultaneous duplicate email resets produce one winner without partial writes | PASS |
| 46 | resetting the legacy administrator email cannot recreate the old default admin | PASS |
| 47 | paused sync makes no GitHub requests and retains local developer assignment | PASS |
| 48 | a browser session update cannot inject a role, email, or GitHub identity | PASS |
| 49 | deleted users and demoted roles cannot retain authorization through JWT refresh | PASS |

Additional checks: GitHub login, existing password authentication and password reset, issue sync regression tests, migration safety checks, TypeScript, and the production build. Local migration preservation was checked against a backup: existing accounts, passwords, GitHub links, memberships, issues, and audit history were unchanged, with no foreign-key violations.

Live GitHub assignment still requires a connected repository token with write access. The application verifies GitHub’s returned assignee rather than treating every successful HTTP response as an assignment success.

Browser checks passed for the admin email dialog at desktop and phone widths: initial focus, keyboard focus trap, invalid email detection, and Escape dismissal. The create-issue picker loaded local developer choices and required an explicit selection. The local browser project was not connected to GitHub, so connected-project behavior and GitHub writes were verified with the simulated API in the automated suite. No real account emails or live GitHub issues were changed by these browser checks.
