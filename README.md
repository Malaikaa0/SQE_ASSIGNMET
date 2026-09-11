# Library Administration System — System Administration Module

Node.js + Express + PostgreSQL backend, React (Vite) frontend. Implements the
7 functional requirements and 3 non-functional requirements listed below with
real relational business logic (rule matching, eligibility evaluation,
deletion guards, lock expiry, live threshold-based alerting) — not just CRUD.

## 1. Prerequisites

- Node.js 18+ (tested with Node 24)
- PostgreSQL running and reachable at `127.0.0.1:5000` (already confirmed running on this machine)
- The PostgreSQL **superuser** password (usually the `postgres` role), needed once to provision the app's role/database.

## 2. Database setup (one-time)

The app connects as `libraryuser` / `library123` to database `library_admin_system`,
but that role/database must be created first by a superuser. A provisioning
script does this for you:

```powershell
cd backend
npm install
$env:PGSUPERUSER="postgres"; $env:PGSUPERPASSWORD="<your postgres superuser password>"; node src/db/init.js
npm run db:seed
```

(bash equivalent: `PGSUPERUSER=postgres PGSUPERPASSWORD=<password> node src/db/init.js`)

This creates the `libraryuser` role and `library_admin_system` database (if not
already present), applies `src/db/schema.sql`, then `npm run db:seed` inserts
sample role templates, staff accounts, patrons, bib/item records, loan rules,
requesting rules, and monitoring thresholds so every screen has real data
immediately.

> I did not have the postgres superuser password and deliberately did not
> weaken `pg_hba.conf` authentication to work around that — you'll need to run
> the one command above yourself (or give me the password to run it for you).

## 3. Run the backend

```powershell
cd backend
copy .env.example .env    # adjust if you changed any defaults
npm run dev
```

This starts:
- **HTTPS API** on `https://localhost:8443` (self-signed cert auto-generated into `backend/certs/` on first run)
- **HTTP** on `http://localhost:8080` that 301-redirects to HTTPS (Req 6511)
- A background system-monitoring loop sampling every 10s (Req 6501)

Because the TLS cert is self-signed, your browser will warn on first contact.
**Open `https://localhost:8443/api/health` once and accept the warning** before
using the frontend, otherwise its API calls will silently fail with a
"cannot reach the API" message.

## 4. Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Log in with one of the seeded accounts:

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin123!` | Administrator (full access) |
| `circsuper` | `Circ123!` | Circulation Supervisor |
| `cataloger` | `Cat123!` | Cataloger |

Every screen shows an inline green (success) or red (error) banner for every
action, including business-rule rejections (e.g. "Cannot delete item: it is
currently checked out to Alice Adult...").

## 5. Feature map

| Requirement | Screen | What it does |
|---|---|---|
| Loan rules (5057) | Loan Rules | CRUD rules by patron/item type; "Checkout Eligibility Tester" runs the real evaluation (blocked statuses, max items out, computes due date + renewal limit) |
| Requesting rules (5190) | Requesting Rules | CRUD rules; "Hold Eligibility Tester" checks holds/balance/item status, supports a logged staff override |
| Deletion restrictions (2445) | Records & Deletion | Deleting a checked-out item or a bib with active holds is blocked with a clear reason; check in / cancel first to unblock |
| Suppression rules (5278) | Suppression Rules | Apply WORKGROUP / LOCATION / ALL suppression to a bib or item; "Visibility Checker" simulates what a given viewer would see |
| Record locks (6513/7302) | Record Locks | Acquire/view locks (who/where/when), configurable timeout, auto-expiry, force-unlock |
| Monitoring & alerts (6501) | Monitoring & Alerts | Live CPU/memory/DB-connections/disk metrics, editable thresholds, alert history, email (or console-simulated) delivery |
| Staff accounts (2420) | Staff Accounts | Create accounts from role templates with granular per-account privilege overrides, password reset, activate/deactivate |

Non-functional requirements are structural, not a separate screen:
- **6510 / 6511** — HTTPS-only backend with auto-generated TLS cert, HTTP→HTTPS redirect, bcrypt-hashed passwords, JWT bearer auth on every protected route.
- **5615** — no server or HTTP caching anywhere (`Cache-Control: no-store` on every response, `fetch(..., {cache:'no-store'})` on every client call); dashboard/monitoring/locks screens additionally poll every 8–10s.

## 6. Assumptions made (for your documentation)

The SRS descriptions you gave define *what* each rule governs but not exact
field names, defaults, or thresholds. Concrete choices made:

**General**
- 9 granular privilege flags were invented (spec didn't name any): `manageStaff`, `manageLoanRules`, `manageRequestingRules`, `deleteRecords`, `manageSuppression`, `manageLocks`, `viewMonitoring`, `manageMonitoring`, `overrideHolds`.
- Password minimum length: 8 characters, no complexity rules beyond that.
- JWT session length: 8 hours; JWT secret is a placeholder in `.env.example` — **replace `JWT_SECRET` before any real deployment.**
- CORS is wide-open (`cors()` default) for local development; restrict to your real frontend origin in production.

**Loan rules (5057)**
- When multiple rules could match a patron/item pair, the most specific one wins: exact patron_type + exact item_type > exact patron_type + `ANY` item_type > `ANY`/`ANY`, tie-broken by a `priority` field (lower number = evaluated first).
- Default statuses that block checkout: `LOST, DAMAGED, IN_REPAIR, WITHDRAWN` (editable per rule).
- Seeded defaults: Adult 15 items / 21-day loan / 2 renewals; Juvenile 8 / 14 / 1; Student 10 / 28 / 3; fallback (any type) 5 / 14 / 1.
- "Current items checked out" = count of that patron's open (unreturned) checkouts across all item types.

**Requesting rules (5190)**
- Matched by patron type only (spec ties this rule to patron type + item *status*, not item *type*).
- Seeded defaults: Adult 10 active holds / $50 balance ceiling; Juvenile 5 / $20; Student 8 / $30; fallback 3 / $10.
- Default statuses that block a hold: `LOST, WITHDRAWN`.
- Staff override: only honored if the matched rule's `allow_staff_override` is true, requires a non-empty reason, and is permanently stored on the hold record (`staff_override`, `override_reason`, `created_by`) for audit — this satisfies "support staff overrides" as a logged, not silent, bypass.

**Deletion restrictions (2445)**
- Item deletion is blocked only by an **open checkout** (no `returned_at`), independent of the item's `status` field.
- Bib deletion is blocked only by holds with `status = 'ACTIVE'` (cancelled/filled holds don't block).
- Item-level holds (a hold pinned to one specific copy) are not currently a deletion guard on the item itself — only bib-level active holds block bib deletion. Flagging this as a scope limitation, not a deliberate design choice, in case your SRS expects it.

**Suppression rules (5278)**
- Three scopes, one active rule per record (creating a new one overwrites the old): `WORKGROUP` (visible only to staff logged into that workgroup), `LOCATION` (visible only to staff/patrons at that location), `ALL` (hidden from everyone, staff and patrons).
- **Interpretation call:** "specific location" was read as *restricting visibility to* that location (mirroring "workgroup-only"), not hiding it *from* that one location. If your SRS means the opposite, it's a one-line flip in `backend/src/routes/suppression.js`.
- There's no public OPAC/search UI in this build (none was requested); visibility is demonstrated via a "Visibility Checker" endpoint that simulates a given viewer context rather than filtering a live catalog search.

**Record lock management (6513 / 7302)**
- Default lock timeout: 15 minutes, stored in `system_settings` and editable from the UI (no default was specified in the SRS text).
- Only one active lock per `(record_type, record_id)`; acquiring a lock on an already-locked record fails with a 409 showing the current holder.
- Expiry is lazy (checked on every read/acquire, not a background timer) — functionally identical to a live view since the UI polls every 8s, but means a lock won't flip to "expired" in the database until the next API call touches it.
- Force-unlock requires the `manageLocks` privilege and records who unlocked it and why.

**System monitoring & alerts (6501)**
- Monitored metrics (spec didn't enumerate them): `CPU_LOAD_PCT`, `MEMORY_USED_PCT`, `DB_CONNECTIONS` (live count from `pg_stat_activity`), `DISK_FREE_PCT`.
- Default thresholds: CPU 70%/90% (warn/critical), Memory 75%/90%, DB connections 15/25, Disk free 20%/10% (this one alerts when the value drops *below* the threshold — configurable via a `higher_is_worse` flag per metric).
- Sampling interval: every 10 seconds (`MONITOR_INTERVAL_SECONDS` in `.env`).
- Alert de-duplication: while a metric stays breached at the same level, a new alert row is only inserted once per 5-minute cooldown (`ALERT_COOLDOWN_MINUTES`) rather than on every 10s sample — otherwise the alert history would flood with hundreds of identical rows. A level change (e.g. WARNING → CRITICAL) always alerts immediately regardless of cooldown.
- **Windows caveat:** `os.loadavg()` always returns `[0,0,0]` on Windows, so CPU load falls back to an instantaneous CPU-busy-time snapshot across cores rather than a true 1-minute load average — a reasonable proxy, not identical semantics.
- **Disk free %:** uses `fs.statfsSync` (works on this machine's Node 24 on Windows, returning real C: drive free space). On older Node versions where `statfsSync` doesn't exist, it falls back to a fixed 65% placeholder rather than adding a native dependency — see `ASSUMPTION` comment in `monitorService.js`.
- Email alerts fire only for `CRITICAL` (not `WARNING`) when the threshold's `email_on_critical` flag is on. If `SMTP_HOST` is left blank in `.env`, emails are logged to the console instead of sent, so the feature is fully testable without a real mail server.

**Staff account setup (2420)**
- 4 seeded role templates with specific default privilege sets: **Administrator** (everything), **Circulation Supervisor** (loan/requesting rules, delete records, locks, hold overrides — no staff/system admin), **Cataloger** (delete records, suppression, locks — no rule/staff/monitoring access), **Reference Staff** (read-only, no privileges). These names/splits are inventions to make the "role templates" concept concrete; adjust freely in `backend/src/db/seed.js`.
- An account's privileges are a one-time copy from its template at creation time, then independently overridable per account (`privilege_overrides` in the UI) — changing a template later does not retroactively change existing accounts, which matches how most ILS role templates behave in practice.

**Non-functional**
- **6510/6511:** TLS is a locally auto-generated self-signed certificate (`backend/certs/`, gitignored) — fine for demonstrating "HTTPS/TLS in transit" locally, but must be replaced with a CA-issued certificate before any real deployment. Passwords are hashed with bcrypt (cost factor 10), never stored or logged in plaintext.
- **5615:** "No caching" was implemented as (a) no in-process/Redis/etc. cache layer anywhere in the codebase — every GET re-queries PostgreSQL, (b) `Cache-Control: no-store` on every HTTP response, and (c) `cache: 'no-store'` on every frontend fetch, plus 8–10s polling on the live-data screens (Dashboard, Monitoring, Locks) so the UI itself feels live, not just the underlying queries.

## 7. Project layout

```
backend/
  src/
    config/db.js        Postgres pool (no query caching)
    middleware/          auth (JWT + privilege checks), no-cache headers
    routes/               one file per functional requirement
    services/             monitoring sampler, mailer
    db/                   schema.sql, init.js (provisioning), seed.js
    utils/certs.js        self-signed TLS cert generation
    server.js             HTTPS/HTTP servers, route wiring
frontend/
  src/
    api.js               fetch wrapper (JWT header, no-store)
    pages/                one page per functional requirement + Dashboard + Login
    components/           Nav, Feedback banner
```
