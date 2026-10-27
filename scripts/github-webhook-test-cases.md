# GitHub webhook test cases

Run `npm run test:github-webhooks`. Tested on 27 October 2026 using real Prisma transactions against an isolated SQLite database and simulated GitHub API responses. No live repository hooks or issues are changed by these automated tests.

| # | Test case | Result |
| --- | --- | --- |
| 1 | known GitHub HMAC-SHA256 test vector is accepted | PASS |
| 2 | webhook setup requires a project developer, lead, or administrator | PASS |
| 3 | localhost setup fails safely without modifying GitHub | PASS |
| 4 | setup registers a repository-scoped signed webhook without returning its secret | PASS |
| 5 | repeating setup reuses the webhook and signing secret | PASS |
| 6 | missing webhook-management permissions return a clean setup error | PASS |
| 7 | missing, malformed, and incorrect signatures cannot change an issue | PASS |
| 8 | signed ping is acknowledged without writing issue history | PASS |
| 9 | wrong repository, hook, and project cannot spoof a status update | PASS |
| 10 | invalid JSON, issue payloads, and delivery IDs are rejected | PASS |
| 11 | oversized payloads are rejected before parsing | PASS |
| 12 | unrelated events, pull requests, and unlinked issue numbers are ignored | PASS |
| 13 | GitHub reopen changes CLOSED to IN_PROGRESS with the real sender in history | PASS |
| 14 | duplicate and concurrent delivery requests do not duplicate history | PASS |
| 15 | reusing a delivery ID with a different payload is rejected | PASS |
| 16 | a QA member with issue-update permission can reopen a linked issue | PASS |
| 17 | viewers, outsiders, and unknown GitHub users cannot mutate Beacon | PASS |
| 18 | paused sync ignores incoming changes | PASS |
| 19 | out-of-order events cannot overwrite the current GitHub state | PASS |
| 20 | GitHub close updates an eligible workflow state to CLOSED | PASS |
| 21 | workflow rules are not bypassed for invalid close transitions | PASS |
| 22 | reopen echoes do not downgrade an active pipeline state | PASS |
| 23 | remote issue ID mismatch cannot reuse a saved issue number | PASS |
| 24 | busy sync deliveries persist and apply after the lease is released | PASS |
| 25 | permissions are rechecked when a queued delivery is retried | PASS |
| 26 | network failures leave a durable update that can be retried | PASS |
| 27 | pending newer Beacon status intent is not overwritten by an incoming event | PASS |
| 28 | outgoing sync drains queued events without causing a reopen loop | PASS |
| 29 | incoming retry controls reject unauthorized callers | PASS |
