# MathRoom

Personal tutoring workspace: separate tutor/student interfaces, LaTeX papers, two-part assignments, shared reasoning photo uploads, grading, and chapter progress.

## Current status

Hosted review: https://mathroom.polime23po.workers.dev

Cloudflare serves the interface and proxies the API to the Supabase `mathroom` Edge Function. The backend uses Postgres transactions, Supabase Auth for password verification/account management, opaque secure HTTP-only application sessions, and private Supabase Storage.

The reviewed application is in `local-review/`. It runs on Node.js 24 with SQLite and is **not yet the hosted implementation**.

```sh
cd local-review
npm ci
npm test
npm start
```

The server is localhost-only. A new local database has no users; tutor provisioning is intentionally not exposed through a public signup endpoint. Existing review databases and credentials are not stored in this repository.

## Hosted implementation

The Supabase project is `ldfoexvqxxckxtmujazz`. Application data is in the private `mathroom` schema. Student roles and access are read from the database, never from editable user metadata. The Edge Function intentionally disables the gateway JWT check because it authenticates opaque application cookies itself; all application endpoints except login/status require a valid session.

Database migrations are versioned in `supabase/migrations/`. All application tables deny direct browser access. The API enforces tutor/student authorization. RLS's no-policy informational advisory is intentional for this server-only schema: [Supabase explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). There are no public Storage policies.

Before real student use: create the tutor in Supabase Authentication using the agreed email and a password of at least 10 characters, with email confirmation enabled. Sign in with the configured Supabase email and password. The preconfigured username `tung` also remains supported. Complete authenticated hosted testing, select local data to migrate, and review the site on a phone. Local review data has not been copied to the cloud.

Admin-created student accounts use internal email identifiers and do not send email; students sign in with their tutor-provided usernames. Reset their passwords through the tutor interface. Creating a user in Supabase Auth alone does not grant app access: a matching private application profile is also required.

Hosted writes serialize through a transaction-scoped Postgres advisory lock for this 5–10-student workspace. Replacement uploads persist new objects before switching the active records; old objects are queued for deletion in the same transaction. Failed cleanup is retried on subsequent writes. Account creation/password changes cross Auth and Postgres boundaries and should be retried carefully on provider failure.

## Build and verification

```sh
npm ci
npm ci --prefix local-review
npm test
npm run check:deploy
npm run deploy
```

The tests include the original local suite, async route regressions, storage adapter and proxy checks. The converted route harness uses SQLite; it does not replace authenticated live Postgres/Storage testing. Live smoke checks verified the site, status endpoint, denial of unauthenticated data requests and foreign-origin writes. Tutor login and full hosted photo/marking flow remain pending tutor account setup. No browser visual check has passed yet.

Cloudflare deployment uses `wrangler.jsonc`. Deploy the Supabase function from `supabase/functions/mathroom/` with `deno.json` imports and `verify_jwt=false`. No service key is required in Cloudflare or the frontend; the Edge Function uses Supabase's injected server secrets. GitHub CI runs tests and a deployment dry run, not automatic production deployment.

## Assignment rules

- Multiple choice first; one attempt, locked when continuing.
- All reasoning questions on the next page; one shared batch of photos.
- Multiple-choice scores and correct answers appear after final submission.
- Pending reasoning work displays “Wait for A Tung review”.
- At most two reasoning submissions. Replacement removes old photos/evaluations and resets marking.
- Chapter averages equally weight fully graded assignment percentages; missing/unmarked work is excluded.

Keep database files, student photos, private backups and service credentials out of Git. Use provider secret configuration for hosted credentials.

## Language

Use the English / Tiếng Việt selector on the login screen or app header. The preference is saved per browser. Interface labels, status messages, confirmations and lesson-review headings support Vietnamese. Tutor comments, names, titles and question content remain exactly as authored; the app does not translate them automatically. Parents use the child’s existing account. Switching languages updates text in place without discarding draft forms, selected answers or photo drafts.

Language checks use a simulated DOM, including persistence, status values, unchanged feedback and unsent work; no visual browser/mobile QA is claimed.
