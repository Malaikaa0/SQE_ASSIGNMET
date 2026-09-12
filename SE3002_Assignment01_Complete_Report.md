# SE3002 — Assignment 01: Quality Evaluation of AI-Generated Software

**Library Administration System — System Administration Module**

**Students:**
- Malaika i24-3098
- Rehan Ahmed i24-3012

**Course:** SE3002 – Software Quality Engineering  
**Institution:** [University Name]  
**Submission Date:** September 12, 2026

**Project:** Library Administration – System Administration Module  
**Baseline Version:** v1.0 (commit bfe098c, tag baseline-v1.0)  
**GitHub Repository:** https://github.com/Malaikaa0/SQE_ASSIGNMET

---

## Table of Contents

1. [Requirement Scope and AI Assumptions](#1-requirement-scope-and-ai-assumptions)
2. [Code + Setup](#2-code--setup)
3. [SonarQube Analysis](#3-sonarqube-analysis)
4. [Non-Functional Requirements (NFR) Evidence](#4-non-functional-requirements-nfr-evidence)
5. [Functional Test Cases](#5-functional-test-cases)
6. [Jira Defect Reports](#6-jira-defect-reports)
7. [Final Quality Judgment](#7-final-quality-judgment)

---

## 1. Requirement Scope and AI Assumptions

### 1.1 Selected SRS

**Title:** Software Requirements Specification for the System Administration of an Integrated Library System (Version 3.0 final)

**Prepared by:** Lori Ayre and Lucien Kress, Galecia Group

**Date:** January 28, 2009

**Scope note:** This SRS covers the System Administration Module of a King County Library System Integrated Library System (ILS) – i.e. server, database, account, security, monitoring, and reporting administration. It explicitly excludes Circulation, Acquisitions, Cataloging, and OPAC/patron-facing modules, which are separate SRS documents.

---

### 1.2 Requirement Scope (7 FR + 3 NFR)

The following table lists the 10 selected requirements (7 Functional, 3 Non-Functional), preserving original SRS requirement IDs and wording. Only one of the seven FRs (Staff account setup, 2420) is a CRUD-type requirement, in compliance with the 3-CRUD limit.

| Req. ID | Type | Requirement (brief) | Why selected / risk | AI assumption | Defence / basis |
|---------|------|---------------------|---------------------|---------------|-----------------|
| **5057** | FR | **Loan rules** – system allows creation/modification of rules that allow or disallow check-out, calculate loan periods, and determine renewal limits based on patron type, item status, and other criteria. | Selected because it represents core business-rule logic (not CRUD) with clear, testable boundaries (e.g. max renewals, unavailable item status). Risk: incorrect rule evaluation could allow checkout of restricted items. | AI implemented per-patron-type defaults seeded in code (Adult: 15 items/21 days/2 renewals; Juvenile: 8/14/1; Student: 10/28/3; fallback: 5/14/1), with field-level defaults of 10 items/21 days/2 renewals applied only if a rule omits a value. AI also invented the rule-resolution order (most specific patron+item match wins, tie-broken by a priority field) and the default blocked-for-checkout statuses (LOST, DAMAGED, IN_REPAIR, WITHDRAWN), none of which the SRS specifies. | unsupported |
| **5190** | FR | **Requesting rules** – system allows creation/modification of rules determining whether a patron can place a hold on an item, evaluating patron type, current holds, account balance, and item status. | Selected for meaningful conditional/permission logic and staff-override behaviour. Risk: incorrect precedence between patron-level and item-level rules. | AI scoped hold limits per patron account (not per branch) and defined the blocking conditions as: inactive patron account, item status in a blocked list (default LOST, WITHDRAWN), account balance exceeding a per-patron-type cap (Adult $50, Juvenile $20, Student $30, fallback $10), and active hold count exceeding a per-type cap (Adult 10, Juvenile 5, Student 8, fallback 3). Staff override requires a non-empty reason and is permanently logged for audit. None of these scopes, values, or the override design are specified in the SRS. | unsupported |
| **2445** | FR | **Business rules** – system supports restrictions based on business rules, e.g. restricting deletion of item records that are checked out, or bibliographic records with existing holds. | Selected as a validation/decision requirement that directly prevents data-integrity violations. Risk: deletion restriction logic may be bypassed via indirect operations (e.g. bulk delete). | AI blocks item deletion based on any open (unreturned) checkout row, independent of the item's status field, and blocks bib deletion only when an ACTIVE hold references the bib. Item-level holds (pinned to one specific copy) were not enforced as a deletion block — only bib-level active holds block bib deletion — narrowing the two example conditions the SRS gives ('e.g.') to a specific, testable implementation. | design decision |
| **5278** | FR | **Suppression rules** – customizable rules specifying whether patrons and staff can view authority, bibliographic, order, and item records in staff and public interfaces. | Selected for its role-based visibility logic across multiple interfaces. Risk: incorrect suppression scope could expose restricted records to patrons. | AI implemented three suppression scopes: WORKGROUP (visible only to staff in the matching workgroup), LOCATION (visible only at the matching location), and ALL (hidden from everyone, staff and patrons). The SRS's 'specific location' wording was read as restricting visibility to that location, mirroring the workgroup rule, rather than hiding it from that location — an interpretation call flagged in code, not an explicit SRS statement. Suppression is demonstrated via a check-visibility endpoint rather than a live OPAC search, since no catalog search UI was in scope. | SRS / design decision |
| **6513 / 7302** | FR | **Record lock management** – staff can identify where a patron/item record is in use (location, user, time) and unlock one or more locked records from a single console. | Selected as a complete workflow (view + unlock) counted as one FR, involving concurrency-aware state management. Risk: unlocking a record mid-edit by another user could cause data loss. | AI implemented a default lock timeout of 15 minutes (configurable at runtime), with stale locks auto-expired lazily on the next read/acquire rather than by a background timer (8-second UI polling makes this feel live, but a stale lock only flips in the DB when next touched). Force-unlock requires a 'manageLocks' privilege and records who unlocked it and why (defaulting to 'Manually unlocked by staff' if no reason given); only one active lock per record is allowed. The 15-minute default and the lazy-expiry mechanism are invented, since the SRS requires a configurable threshold but specifies neither a default nor an expiry mechanism. | unsupported |
| **6501** | FR | **System monitoring** – system monitors resources (disk, CPU, memory, processes, interfaces) with configurable alert thresholds sent via dashboard, email, and text message. | Selected for threshold-based decision logic and multi-channel alerting behaviour. Risk: incorrect threshold logic could cause missed or excessive alerts. | AI implemented dashboard and email alert channels; SMS/text alerting was skipped as out of scope due to third-party gateway cost/complexity (email falls back to console logging if no SMTP server is configured). AI also invented the specific metrics monitored (CPU load, memory used, DB connections, disk free), their warning/critical thresholds (e.g. CPU 70%/90%, memory 75%/90%, DB connections 15/25, disk free 20%/10%), a 10-second sampling interval, and a 5-minute alert-cooldown per metric+level to stop duplicate alerts — none of which the SRS specifies. | design decision / unsupported |
| **2420** | FR | **Staff account setup** – dedicated interface for creating new staff accounts with configurable templates and granular privileges for creation, modification, and deletion. | Selected as the pair's single CRUD-type requirement (within the 3-CRUD limit), needed as the foundation for role/privilege-based access used by other FRs. Risk: privilege assignment errors could grant excess access. | AI implemented four role templates (Administrator, Circulation Supervisor, Cataloger, Reference Staff), each with a different split across nine invented granular privilege keys (e.g. manageStaff, manageLoanRules, deleteRecords, manageLocks, overrideHolds). An account's privileges are copied from its template at creation and can be individually overridden afterward; changing a template later does not retroactively update existing accounts. Minimum password length (8 characters) and username rules (3–30 alphanumeric/._- characters) were also invented, since the SRS requires configurable templates and privileges but names neither the templates, the privilege set, nor any password/username policy. | unsupported |
| **6510** | NFR | **Patron data security** – patron data is secure in all transfers to and from the system. | Selected as a directly testable security NFR relevant to every module that handles patron data. | AI implemented password hashing via bcrypt (cost factor 10) so passwords are never stored or logged in plaintext, and transport encryption via an auto-generated self-signed TLS certificate (2048-bit RSA, 825-day validity) served over HTTPS — flagged in code as dev-grade and needing a CA-signed certificate before production. These mechanisms were chosen as the concrete implementation of the SRS's general 'secure' requirement, which specifies no mechanism. | design decision |
| **6511** | NFR | **Secure protocol support** – system supports secure protocols including SFTP, SSL, and SSH, with SFTP supported in active and passive modes. | Selected as a concrete, inspectable security requirement with explicit protocol names, allowing direct verification in configuration/code. | AI implemented HTTPS/TLS only for the API, with a plain HTTP listener that exists solely to redirect to HTTPS, and session auth via bearer JWT over that channel. SFTP and SSH were not implemented at all, since the system has no file-transfer or remote-shell surface for them to apply to. CORS is also left wide open (no origin restriction) — fine for local development but a gap worth flagging under 'secure protocol' territory. Dropping SFTP/SSH entirely has no explicit SRS or documented design basis. | unsupported |
| **5615** | NFR | **Real-time processing** – the system provides real-time processing, e.g. pull lists and reports reflect current data at the time of viewing. | Selected as a testable performance NFR directly tied to data freshness and responsiveness of the selected FRs. | AI implemented real-time processing as no caching anywhere: no cache layer (Redis/memory-cache/etc.) exists, every route queries Postgres directly, every HTTP response carries no-store/no-cache headers, and every frontend fetch uses cache:'no-store'. The Dashboard, Monitoring, and Locks screens additionally poll every 8–10 seconds so the UI feels live. This fresh-fetch-per-request design was chosen since the SRS describes the real-time behaviour but gives no numeric response-time threshold. | design decision |

---

### 1.3 AI Assumption Basis – Summary

Each material assumption introduced during AI-assisted development is classified below as (a) supported by the SRS, (b) justified by an explicit design decision, or (c) unsupported. Unsupported assumptions are disclosed rather than hidden, per assignment requirements.

#### (a) Supported by the SRS

1. **5278 – Suppression rules:** The three visibility scopes (workgroup, location, all) match those listed in the SRS text.

#### (b) Justified by an explicit design decision

1. **2445 – Business rules:** Item-deletion blocked by any open checkout, bib-deletion blocked by active holds — narrows the SRS's two examples ('e.g.') to a specific, testable implementation.

2. **6501 – System monitoring:** Dashboard and email channels implemented; SMS/text alerting excluded from the baseline due to third-party gateway cost/complexity.

3. **6510 – Patron data security:** bcrypt password hashing and a self-signed TLS certificate chosen as the concrete mechanism for the SRS's general 'secure' requirement.

4. **5615 – Real-time processing:** Implemented as no-cache, fresh-fetch-per-request (verified by construction), with 8–10s UI polling on data-sensitive screens.

#### (c) Unsupported

1. **5057 – Loan rules:** Per-patron-type numeric defaults, the rule-resolution precedence, and the blocked-status list are all invented, with no SRS basis.

2. **5190 – Requesting rules:** Per-patron-account scope and the per-type balance/hold-count limits are invented, with no SRS basis.

3. **6513 / 7302 – Record lock management:** The 15-minute default timeout and the lazy-expiry mechanism are invented defaults.

4. **2420 – Staff account setup:** The four named account templates and the nine granular privilege keys are invented wholesale; the SRS requires templates but names none.

5. **6511 – Secure protocol support:** SFTP/SSH support was dropped from the baseline entirely without an explicit, documented design justification.

6. **5278 – Suppression rules:** Reading 'specific location' as restricting-to (rather than hiding-from) that location is an interpretation call flagged in code, not an explicit SRS statement.

7. **6501 – System monitoring:** The specific metrics monitored and their warning/critical thresholds are invented; the SRS specifies neither.

---

### 1.4 Notes on Requirement Selection

Six of the seven selected FRs (5057, 5190, 2445, 5278, 6513/7302, 6501) represent business rules, validation logic, permissions, or workflows rather than plain data management, satisfying the requirement that FRs beyond the CRUD allowance reflect meaningful behaviour. The three NFRs (6510, 6511, 5615) were selected because they are independently testable through a combination of SonarQube evidence (security-related findings) and targeted manual/structural testing (real-time data freshness), consistent with Part 3A of the assignment.

---

## 2. Code + Setup

### 2.1 Frozen Baseline Source Code

**Version Information:**
- **Commit Hash:** bfe098c
- **Git Tag:** baseline-v1.0
- **Freeze Date:** September 11, 2026
- **Repository:** https://github.com/Malaikaa0/SQE_ASSIGNMET

**Code Structure:**
```
SQE_ASSIGNMET/
├── backend/
│   ├── src/
│   │   ├── config/         # Database configuration
│   │   ├── db/             # Schema and seed scripts
│   │   ├── middleware/     # Auth, no-cache middleware
│   │   ├── routes/         # API route handlers (8 modules)
│   │   ├── services/       # Mailer, monitoring services
│   │   └── utils/          # Certificate generation utilities
│   ├── certs/              # Self-signed TLS certificates
│   └── package.json        # Dependencies
├── frontend/
│   ├── src/
│   │   ├── pages/          # React page components
│   │   ├── components/     # Reusable UI components
│   │   └── api.js          # Centralized API client
│   └── package.json        # Dependencies
└── README.md               # Setup instructions
```

**Technology Stack:**
- **Backend:** Node.js (v24.x), Express.js, PostgreSQL 14.x
- **Frontend:** React 18.x, Vite, TailwindCSS
- **Security:** bcrypt, JWT, HTTPS/TLS
- **Development:** AI-assisted coding (GitHub Copilot, Claude)

---

### 2.2 Setup and Run Instructions

#### Prerequisites
- Node.js v18+ and npm
- PostgreSQL 14+ or Docker
- Git

#### Backend Setup

1. **Start PostgreSQL Database (Docker)**
   ```bash
   docker run -d --name library-postgres \
     -e POSTGRES_PASSWORD=postgrespass \
     -p 5000:5432 \
     postgres:16-alpine
   ```

2. **Initialize Database Schema**
   ```bash
   cd backend
   PGSUPERUSER=postgres PGSUPERPASSWORD=postgrespass node src/db/init.js
   npm run db:seed
   ```

3. **Install Dependencies and Start Backend**
   ```bash
   npm install
   npm run dev
   ```
   Backend runs at: `https://localhost:8443`

#### Frontend Setup

1. **Install Dependencies and Start Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Frontend runs at: `http://localhost:5173`

#### Access the Application

1. Open `https://localhost:8443` in browser to accept self-signed certificate
2. Navigate to `http://localhost:5173`
3. Login with: `admin / Admin123!`

---

### 2.3 AI-Assisted Development Record

#### AI Tools Used
- **GitHub Copilot** - Code completion and boilerplate generation
- **Claude (Anthropic)** - Architecture design, complex business logic, testing strategy
- **ChatGPT** - Documentation, code refactoring suggestions

#### Development Approach

**Phase 1: Requirements Analysis (AI-Assisted)**
- Used Claude to analyze SRS document and extract 10 requirements (7 FR + 3 NFR)
- AI identified CRUD vs. business-logic requirements to comply with 3-CRUD limit
- Generated requirement rationale and risk assessment with AI assistance

**Phase 2: Architecture Design (Human-Led, AI-Augmented)**
- Human decision: Express.js backend + React frontend architecture
- AI-generated: Database schema from requirements (revised by humans)
- AI-generated: REST API endpoint structure based on requirements
- Human decision: JWT authentication, bcrypt password hashing

**Phase 3: Implementation (AI-Heavy)**
- **Backend (80% AI-generated code)**:
  - Route handlers: AI generated base CRUD operations; humans added business logic
  - Middleware: AI-generated auth and no-cache middleware
  - Database queries: AI wrote SQL with parameter binding; humans reviewed for injection safety
  - Services: Monitoring service 70% AI-generated, mailer service 90% AI-generated

- **Frontend (85% AI-generated code)**:
  - React components: AI scaffolded components; humans styled and added error handling
  - API integration: AI wrote fetch wrappers with no-cache headers
  - Forms: AI generated form structure; humans added validation

**Phase 4: Testing (Human-Executed, AI-Assisted Test Design)**
- AI generated test condition ideas from requirements
- Humans executed all 15 test cases manually against running system
- AI helped format test results into structured tables

#### Key AI Assumptions Made

The following assumptions were introduced by AI during development and are documented in Part 1 of this report:

1. **FR-5057 (Loan rules):** Default loan period (21 days) and renewal limit (2) - invented values
2. **FR-5190 (Requesting rules):** Hold limits enforced per patron account (not per branch)
3. **FR-6513/7302 (Lock management):** Fixed 15-minute lock timeout default
4. **FR-2420 (Staff accounts):** Three account templates (Admin, System Administrator, General Staff)
5. **NFR-6511 (Secure protocols):** SFTP/SSH excluded from baseline scope

#### Human Oversight and Corrections

- Reviewed all AI-generated SQL for injection vulnerabilities (none found)
- Added `Cache-Control: no-store` middleware (AI initially missed this NFR)
- Corrected AI's misunderstanding of "real-time" requirement (no caching vs. low latency)
- Fixed AI-generated accessibility issues (form labels) identified by SonarQube
- Removed AI's overcomplicated authentication flow; simplified to JWT-only

#### Code Quality Observations

**AI Strengths:**
- Consistent code style and naming conventions
- Proper error handling in most cases
- Security-conscious (parameterized queries, bcrypt, JWT)

**AI Weaknesses Requiring Human Fix:**
- Did not initially implement input validation on UPDATE endpoints (source of BUG-001, BUG-003)
- Missed FK constraint check for holds on item deletion (source of BUG-002)
- Generated overly complex conditional logic (SonarQube cognitive complexity findings)
- Poor accessibility (form labels not associated with inputs)

---

## 3. SonarQube Analysis

### 3.1 Analysis Configuration

**SonarQube Setup:**
- **Version:** 13.7.0 (Community Edition)
- **Server:** http://localhost:9000 (Docker container)
- **Scanner:** sonar-scanner 5.0.1
- **Project Key:** Library-Management
- **Analysis Date:** September 11, 2026
- **Baseline Commit:** bfe098c (tag: baseline-v1.0)

**Scan Scope:**
- **Files Analyzed:** 34 JavaScript/JSX source files
  - Backend: 16 files (~1,200 LOC)
  - Frontend: 18 files (~1,300 LOC)
- **Total Lines of Code:** ~2,500 lines
- **Exclusions:** node_modules/, certs/, .git/

**Configuration File (sonar-project.properties):**
```properties
sonar.projectKey=Library-Management
sonar.projectName=Library Management System
sonar.projectVersion=1.0
sonar.sources=backend/src,frontend/src
sonar.exclusions=**/node_modules/**,**/certs/**
sonar.javascript.lcov.reportPaths=coverage/lcov.info
```

---

### 3.2 Overall Quality Metrics

**Quality Gate Status:** ❌ **Failed**

| Metric | Value | Rating |
|--------|-------|--------|
| **Bugs** | 6 issues | C (Moderate) |
| **Vulnerabilities** | 0 issues | A (Excellent) |
| **Security Hotspots** | 1 issue (requires review) | E (Needs Review) |
| **Code Smells** | 12 issues | C (Moderate) |
| **Technical Debt** | ~2 hours | Moderate |
| **Code Duplication** | 0% | A (Excellent) |
| **Test Coverage** | 0% | N/A (no tests) |
| **Maintainability Rating** | C | Moderate |
| **Reliability Rating** | C | Moderate |
| **Security Rating** | B | Good |

---

### 3.3 Five Selected Findings - Detailed Interpretation

#### Finding 1: Hardcoded Database Credentials (CRITICAL SECURITY ISSUE)

**SonarQube Report:**
- **Rule:** Credentials should not be hard-coded
- **Type:** Vulnerability
- **Severity:** Critical
- **Location:** `backend/src/config/db.js` (Line 7)
- **Category:** Security

**What SonarQube Reported:**

SonarQube detected hard-coded credentials in the database configuration file:

```javascript
const pool = new Pool({
  user: 'libraryuser',
  password: 'library123',  // ← Hardcoded password (CRITICAL)
  database: 'library_admin_system',
  host: '127.0.0.1',
  port: 5000
});
```

**Where It Occurs:**

This violation is in `backend/src/config/db.js`, which is imported throughout the backend whenever database operations are performed.

**Why It Matters:**

1. **Security Risk:** Credentials exposed to anyone with repository access
2. **Version Control Exposure:** Permanently stored in Git history
3. **Environment Portability:** Prevents secure deployment across environments
4. **Compliance Violations:** Violates OWASP, PCI-DSS, SOC 2 standards
5. **Credential Rotation:** Requires code changes instead of config updates

**What Action the Evidence Supports:**

- **Priority:** HIGH - Critical security issue requiring immediate fix
- **Required Action:** Move credentials to environment variables:
  ```javascript
  const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT
  });
  ```
- **Additional Steps:** 
  - Add `.env` to `.gitignore`
  - Provide `.env.example` with dummy values
  - Document environment variable setup in README

**Evidence Status:** ✅ Confirmed - Genuine security vulnerability requiring immediate remediation

---

#### Finding 2: Excessive Cognitive Complexity (MAINTAINABILITY ISSUE)

**SonarQube Report:**
- **Rule:** Cognitive Complexity of functions should not be too high
- **Type:** Code Smell
- **Severity:** High
- **Location:** `backend/src/routes/requestingRules.js` (Line 95)
- **Category:** Maintainability
- **Measured Complexity:** 18
- **Threshold:** 15

**What SonarQube Reported:**

Function has Cognitive Complexity of 18, exceeding threshold of 15. Contains:
- Multiple nested `if/else` statements
- Loops over patron rules
- Error handling blocks
- Nested validation checks
- Multiple return paths

**Where It Occurs:**

Eligibility evaluation function in `backend/src/routes/requestingRules.js` that determines whether a patron can place a hold based on patron type, account balance, active holds, and item status.

**Why It Matters:**

1. **Readability:** High complexity makes code harder to understand
2. **Testing Difficulty:** Requires more test cases for adequate coverage
3. **Bug Likelihood:** Research shows correlation between complexity and defect density
4. **Maintenance Cost:** Riskier and more time-consuming modifications
5. **Code Reviews:** Reviewers struggle to verify correctness
6. **Onboarding:** Steeper learning curve for new developers

**What Action the Evidence Supports:**

- **Priority:** MEDIUM - Does not affect functionality but impacts maintainability
- **Refactor Approach:**
  - Extract patron validation: `validatePatronEligibility()`
  - Extract item checking: `validateItemAvailability()`
  - Extract hold limits: `checkHoldLimits()`
  - Extract balance: `checkAccountBalance()`
- **Benefits:** Improved testability, better readability, easier modifications

**Evidence Status:** ✅ Confirmed - Legitimate maintainability concern requiring refactoring

---

#### Finding 3: Overly Permissive CORS Configuration (SECURITY HOTSPOT)

**SonarQube Report:**
- **Rule:** Make sure that enabling CORS is safe here
- **Type:** Security Hotspot
- **Severity:** Medium
- **Location:** `backend/src/server.js` (Line 23)
- **Category:** Security

**What SonarQube Reported:**

Overly permissive CORS policy allows requests from any origin:

```javascript
app.use(cors());  // Allows all origins by default
```

**Where It Occurs:**

CORS middleware in `backend/src/server.js`, applied globally to all routes.

**Why It Matters:**

1. **CSRF Risk:** Malicious websites can make authenticated requests
2. **Data Exposure:** Sensitive data readable by third-party sites
3. **Session Hijacking:** Attacker domains can leverage user sessions
4. **Compliance:** Standards (PCI-DSS, HIPAA) require restricted access
5. **Defense in Depth:** Unrestricted CORS weakens security posture

**Security Impact Scenarios:**

- User logged into library system visits malicious website
- That website's JavaScript makes requests to API endpoints
- Attacker extracts patron data, staff info, or system configuration
- Phishing site performs actions on behalf of authenticated user

**What Action the Evidence Supports:**

- **Priority:** HIGH - Security configuration issue for deployment
- **Required Fix:** Restrict CORS to trusted origins:
  ```javascript
  const corsOptions = {
    origin: 'http://localhost:5173',  // Frontend dev server
    credentials: true,
    optionsSuccessStatus: 200
  };
  app.use(cors(corsOptions));
  ```
- **Production Update:** Use actual frontend domain
- **Additional Security:**
  - Implement CSRF tokens
  - Validate `Origin`/`Referer` headers
  - Use SameSite cookie attributes
- **Current Risk:** MEDIUM - Partially mitigated by HTTPS and JWT auth

**Evidence Status:** ⚠️ Requires Review - Inappropriate for multi-user/production environment

---

#### Finding 4: Inaccessible Form Labels (RELIABILITY/ACCESSIBILITY)

**SonarQube Report:**
- **Rule:** Form labels should be associated with controls
- **Type:** Bug
- **Severity:** Medium
- **Location:** `frontend/src/pages/Login.jsx` (Line 36)
- **Category:** Reliability / Accessibility

**What SonarQube Reported:**

`<label>` elements not properly associated with form controls. Missing:
- `for` attribute matching input `id`, or
- Input nested inside label, or
- Visible text content

Current problematic pattern:
```jsx
<label>Username</label>
<input type="text" name="username" />  // Missing id, no 'for' attribute
```

**Where It Occurs:**

Login page (`frontend/src/pages/Login.jsx`) and other form pages (Staff, Records, etc.).

**Why It Matters:**

1. **Screen Reader Accessibility:** Assistive technologies can't announce field purpose
2. **WCAG Violation:** Fails WCAG 2.1 Level A criteria 1.3.1 and 4.1.2
3. **Keyboard Navigation:** Users lack context when field receives focus
4. **User Experience:** Can't click label to focus input
5. **Legal Risk:** Accessibility laws (ADA, Section 508, European Accessibility Act)
6. **Inclusive Design:** Excludes users with disabilities

**Impact:**
- **Affected Users:** ~15% of web users rely on assistive technologies
- **Severity:** Complete blocker for screen reader users logging in
- **Business Impact:** Limited user base, potential legal liability

**What Action the Evidence Supports:**

- **Priority:** MEDIUM-HIGH - Blocks accessibility users
- **Required Fix (Option 1 - Explicit Association):**
  ```jsx
  <label htmlFor="username">Username</label>
  <input type="text" id="username" name="username" />
  ```
- **Required Fix (Option 2 - Implicit Association):**
  ```jsx
  <label>
    Username
    <input type="text" name="username" />
  </label>
  ```
- **Scope:** Apply to all forms across application
- **Testing:** Verify with screen reader (NVDA, VoiceOver)
- **Compliance:** Required for WCAG 2.1 Level A

**Evidence Status:** ✅ Confirmed - Genuine accessibility defect blocking assistive technology users

---

#### Finding 5: Nested Ternary Operators (MAINTAINABILITY)

**SonarQube Report:**
- **Rule:** Nested ternary operators should not be used
- **Type:** Code Smell
- **Severity:** Medium
- **Location:** `frontend/src/pages/Suppression.jsx` (Line 156)
- **Category:** Maintainability

**What SonarQube Reported:**

Nested ternary operator in Suppression page creates complex, hard-to-read expressions:

```jsx
{status === 'loading' ? 
  <Spinner /> : 
  error ? 
    <ErrorMessage /> : 
    data ? <DataDisplay /> : <EmptyState />
}
```

**Where It Occurs:**

Suppression page's JSX rendering logic, likely in conditional rendering determining UI component based on multiple states.

**Why It Matters:**

1. **Readability:** Requires significant cognitive effort to parse
2. **Maintenance:** Future developers struggle to understand logic flow
3. **Error-Prone:** Easy to introduce logical errors during modifications
4. **Debugging:** Stepping through nested ternaries less straightforward
5. **Code Review:** Reviewers spend more time verifying correctness
6. **Team Collaboration:** Not all team members comfortable with complex ternaries

**What Action the Evidence Supports:**

- **Priority:** LOW-MEDIUM - Code functions correctly but readability suffers
- **Refactor Option 1 (If/Else Blocks):**
  ```jsx
  let content;
  if (status === 'loading') {
    content = <Spinner />;
  } else if (error) {
    content = <ErrorMessage />;
  } else if (data) {
    content = <DataDisplay />;
  } else {
    content = <EmptyState />;
  }
  return <div>{content}</div>;
  ```
- **Refactor Option 2 (Extract to Function):**
  ```jsx
  const renderContent = () => {
    if (status === 'loading') return <Spinner />;
    if (error) return <ErrorMessage />;
    if (data) return <DataDisplay />;
    return <EmptyState />;
  };
  return <div>{renderContent()}</div>;
  ```
- **Scope:** Review all React components for similar patterns
- **Best Practice:** Limit ternaries to simple binary conditions

**Evidence Status:** ✅ Confirmed - Legitimate code quality issue; refactoring improves readability

---

### 3.4 SonarQube Quality Areas Summary

#### Maintainability (Rating: C)
- **Issues:** 12 code smells
- **Technical Debt:** ~2 hours
- **Key Concerns:**
  - Cognitive complexity 18 > 15 in business rule functions
  - Nested ternary operators reducing readability
  - Complex conditional logic in route handlers
- **Impact:** Moderate effort required to modify and extend; technical debt will accumulate if not addressed

#### Reliability (Rating: C)
- **Issues:** 6 bugs
- **Key Concerns:**
  - Accessibility issues with form labels
  - Missing error handling in some paths
  - Potential null pointer dereferences if validation bypassed
- **Impact:** Core functionality works for typical users, but edge cases and accessibility not fully addressed

#### Security (Rating: B)
- **Vulnerabilities:** 0 critical vulnerabilities
- **Security Hotspots:** 1 requiring review
- **Key Concerns:**
  - Hardcoded database credentials (Critical)
  - Overly permissive CORS (Medium)
- **Positive:** No SQL injection, XSS, or common web vulnerabilities
- **Impact:** Would improve to A if credential management and CORS addressed

#### Context Metrics
- **Lines of Code:** ~2,500
- **Files:** 34 (16 backend, 18 frontend)
- **Duplication:** 0% (excellent)
- **Test Coverage:** 0% (no test execution reports)
- **Quality Gate:** Failed (due to security and quality issues)

---

## 4. Non-Functional Requirements (NFR) Evidence

### 4.1 NFR-6510/6511: Security - HTTPS/TLS Encryption and Secure Authentication

**Requirement Description:**

The system must enforce HTTPS/TLS encryption for all communications, automatically redirect HTTP to HTTPS, use bcrypt for password hashing, and implement JWT authentication on all protected routes.

#### SonarQube Evidence

- ✅ **Security Rating: B** - No SQL injection, XSS, or auth bypass vulnerabilities
- ✅ **Password Hashing:** No plaintext storage detected
- ⚠️ **Hardcoded Credentials:** Critical finding (Finding #1)
- ⚠️ **CORS Configuration:** Overly permissive (Finding #3)
- ✅ **JWT Secret:** Properly referenced from environment variables

#### Other Evaluation Methods

**1. Manual Code Inspection:**
- `backend/src/server.js`: Verified HTTPS server with self-signed certificates
- `backend/src/server.js`: Confirmed HTTP (8080) redirects to HTTPS (8443) with 301
- `backend/src/middleware/auth.js`: JWT verification middleware on protected routes
- `backend/src/routes/auth.js`: bcrypt.hash() with cost factor 10
- `backend/src/utils/certs.js`: Self-signed certificate generation

**2. Runtime Testing:**
- `http://localhost:8080/api/health` → Redirected to `https://localhost:8443/api/health` (301)
- Browser shows padlock icon (expected for self-signed cert)
- Protected route `/api/staff` without JWT → 401 Unauthorized
- Invalid/expired JWT → 401/403 response

**3. Database Inspection:**
- Queried `staff` table password column
- All passwords stored as bcrypt hashes (starting with `$2b$10$`)
- No plaintext passwords found

#### Finding / Judgment

✅ **PARTIALLY COMPLIANT**

**Implemented Correctly:**
- ✅ HTTPS/TLS operational with self-signed certificates
- ✅ HTTP→HTTPS 301 redirect working
- ✅ Bcrypt password hashing (cost 10)
- ✅ JWT authentication protecting sensitive routes
- ✅ No authentication bypass vulnerabilities

**Issues Identified:**
- ❌ **Critical:** Database credentials hardcoded (violates secure credential management)
- ⚠️ **Medium:** CORS allows all origins (weakens security)
- ⚠️ **Low:** Self-signed cert acceptable for dev; needs CA cert for production

**Overall Status:** Core security mechanisms correctly implemented, but credential management violates best practices and must be remediated.

#### Limitations

- SonarQube cannot verify runtime HTTPS enforcement or TLS handshake security
- Self-signed certificates provide encryption but not identity verification
- Comprehensive security requires penetration testing beyond static analysis
- Cannot assess JWT secret entropy/strength (only detects if hardcoded)

---

### 4.2 NFR-5615: No Caching - Real-Time Data Access

**Requirement Description:**

System must not cache data at any layer. All queries fetch fresh database results, HTTP responses include `Cache-Control: no-store`, client requests use `cache: 'no-store'`, and live-data screens poll every 8-10 seconds.

#### SonarQube Evidence

N/A - SonarQube static analysis does not detect caching mechanisms or HTTP headers. Runtime/architectural concern requires code inspection and behavioral testing.

#### Other Evaluation Methods

**1. Code Inspection - Backend:**
- Examined all route handlers in `backend/src/routes/*.js` (8 files)
- ✅ No in-memory caching (no Redis, Map caches, memoization)
- ✅ Every GET request executes fresh SQL via `pool.query()`
- ✅ `backend/src/middleware/noCache.js` applies headers:
  ```javascript
  Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
  Pragma: no-cache
  Expires: 0
  ```
- ✅ Middleware registered globally before all routes

**2. Code Inspection - Frontend:**
- `frontend/src/api.js`: All API calls use `fetch(url, { cache: 'no-store' })`
- Live-data components:
  - `Dashboard.jsx`: Polling via `setInterval` every 8 seconds
  - `Monitoring.jsx`: Polling via `setInterval` every 10 seconds  
  - `Locks.jsx`: Polling via `setInterval` every 8 seconds
- ✅ No React Query, SWR, or client caching libraries in `package.json`

**3. HTTP Header Testing (Browser DevTools):**

Tested `GET /api/staff`, response headers:
```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
```
✅ Correct no-cache headers on all API responses

**4. Behavioral Testing:**
- Modified staff account name directly in database
- Refreshed Staff page → Updated name displayed immediately
- ✅ No stale data from cache
- Dashboard: Observed live metrics update every 8 seconds
- ✅ Polling mechanism functional

#### Finding / Judgment

✅ **FULLY COMPLIANT**

- ✅ No application-layer caching (no Redis, in-memory cache)
- ✅ All database queries fresh on every request
- ✅ HTTP `Cache-Control: no-store` on all responses
- ✅ Client requests use `cache: 'no-store'`
- ✅ Live screens poll every 8-10 seconds
- ✅ No client-side caching libraries

Implementation demonstrates consistent no-caching across all layers.

#### Limitations

- Only Chrome tested; other browsers not verified
- Proxy/CDN caching configuration not tested (would require deployment)
- No performance testing under load
- Long-term polling consistency (after errors) not exhaustively tested

---

### 4.3 NFR-6501: System Monitoring and Alerts

**Requirement Description:**

System must monitor CPU load, memory usage, database connections, and disk space. When thresholds breached, alerts generated, stored in database, and delivered via email (or logged if not configured). Background monitoring samples metrics every 10 seconds.

#### SonarQube Evidence

N/A - SonarQube does not evaluate runtime monitoring, background processes, or alerting. Requires functional testing and code inspection.

#### Other Evaluation Methods

**1. Code Inspection:**
- `backend/src/services/monitorService.js`:
  - ✅ Background service using `setInterval` (10,000ms = 10 seconds)
  - ✅ Samples CPU (os.cpus(), os.loadavg()), memory (os.freemem(), os.totalmem())
  - ✅ Queries database connection count
  - ✅ Reads disk space (via child_process df command)
  - ✅ Compares metrics against thresholds (warning, critical)
  - ✅ Generates alerts with 5-minute cooldown to prevent duplicates
  - ✅ Inserts alerts into `system_alerts` table
  - ✅ Calls mailer service for email delivery

**2. Runtime Functional Testing:**

**Test 1: Verify Monitoring Service Running**
- Started backend with `npm run dev`
- Console output: "System monitoring started (sampling every 10s)"
- ✅ Background service initialized

**Test 2: Sample Live Metrics**
- API call: `GET /api/monitoring/live`
- Response:
  ```json
  {
    "metrics": {
      "CPU_LOAD_PCT": 20.44,
      "MEMORY_USED_PCT": 86.48,
      "DB_CONNECTIONS": 1,
      "DISK_FREE_PCT": 9.6
    },
    "timestamp": "2026-09-11T18:42:03.456Z"
  }
  ```
- ✅ All metrics within valid ranges (0-100% or positive integers)
- ✅ Windows CPU fallback working (os.loadavg() = 0 on Windows, fallback to CPU usage calculation)

**Test 3: Threshold Configuration**
- API call: `GET /api/monitoring/thresholds`
- Response shows 4 thresholds configured:
  - CPU_LOAD_PCT: warning 70%, critical 90%
  - MEMORY_USED_PCT: warning 80%, critical 95%
  - DISK_FREE_PCT: warning 20%, critical 10% (lower_is_worse: true)
  - DB_CONNECTIONS: warning 8, critical 10
- ✅ Thresholds configured and retrievable

**Test 4: Alert Generation on Threshold Breach**
- Current DISK_FREE_PCT: 9.6%
- Critical threshold: 10%
- Since 9.6% < 10% and higher_is_worse=false for disk free: **CRITICAL ALERT EXPECTED**
- API call: `GET /api/monitoring/alerts` (filtered to last hour)
- Response shows alert id 76:
  ```json
  {
    "id": 76,
    "metric_name": "DISK_FREE_PCT",
    "level": "CRITICAL",
    "value": "9.60",
    "threshold": "10.00",
    "message": "CRITICAL: Disk free space 9.6% is below critical threshold 10.0%",
    "emailed": true,
    "acknowledged": false,
    "triggered_at": "2026-09-11T18:42:03.789Z"
  }
  ```
- ✅ Alert generated correctly
- ✅ Email attempted (logged as sent)
- ✅ Inclusive boundary comparison working (9.6% <= 10% triggered alert)

**Test 5: Alert Acknowledgement**
- API call: `POST /api/monitoring/alerts/76/acknowledge`
- Response: `{"success": true, "acknowledged_by": 1}`
- Re-fetched alert: `acknowledged: true, acknowledged_by: 1, acknowledged_at: "2026-09-11T18:45:12.123Z"`
- ✅ Acknowledgement persisted

**Test 6: Alert Cooldown (Duplicate Suppression)**
- Waited 10 seconds for next monitoring cycle
- Checked alerts table: No new DISK_FREE_PCT CRITICAL alert created
- ✅ 5-minute cooldown working (prevents duplicate alerts for same metric/level)

**3. Database Inspection:**
- Queried `system_alerts` table
- Confirmed alerts persisted with all fields (metric_name, level, value, threshold, message, emailed, triggered_at)
- ✅ Alert storage working

**4. Email Testing (Simulated):**
- SMTP not configured (no SMTP_HOST in .env)
- Mailer service logged: "Email not configured; alert logged instead"
- ✅ Fallback to logging working as documented

#### Finding / Judgment

✅ **FULLY COMPLIANT**

- ✅ Background monitoring service samples every 10 seconds
- ✅ Monitors CPU, memory, disk, database connections
- ✅ Threshold comparison working (warning, critical levels)
- ✅ Inclusive boundary comparison (>= for higher_is_worse, <= for lower_is_worse)
- ✅ Alerts generated and persisted in database
- ✅ Email delivery attempted (fallback to logging if not configured)
- ✅ Alert cooldown prevents duplicates (5-minute window)
- ✅ Alert acknowledgement working
- ✅ Windows CPU fallback path functional

Implementation fully satisfies monitoring and alerting requirements.

#### Limitations

- Email delivery not tested with actual SMTP server (only logging verified)
- Long-term monitoring stability not tested (hours/days of continuous operation)
- Performance impact of monitoring service not measured
- Dashboard/email alert delivery delay not quantified

---

## 5. Functional Test Cases

### 5.1 Test Execution Overview

**System Under Test:** Library Administration System - Backend API  
**Version:** Baseline v1.0 (commit bfe098c, tag baseline-v1.0)  
**Test Environment:** https://localhost:8443  
**Test Method:** Direct API calls (curl/Postman) against live application  
**Test Accounts:** admin, circsuper, cataloger (seeded)  
**Execution Date:** September 11, 2026  
**Tester:** QA Team

**Test Summary:**
- **Total Test Cases:** 15
- **Passed:** 12 (80%)
- **Failed:** 3 (20%)
- **Blocked:** 0
- **Not Executed:** 0

### 5.2 Test Category Coverage

✅ **Boundary Tests:** 6 cases (TC-02, TC-03, TC-05, TC-07, TC-08, TC-14, TC-15)  
✅ **Invalid/Error Tests:** 3 cases (TC-01 partial, TC-02 partial, TC-03 partial, TC-06, TC-14)  
✅ **Manual System-Level Tests:** 7 cases (TC-01, TC-05, TC-08, TC-09, TC-10, TC-12, TC-13)  
✅ **Failed Tests:** 3 cases (TC-06, TC-10, TC-14)

---

### 5.3 Test Condition Record (Table A)

#### FR-5057: Loan Rules
| Condition | Description |
|-----------|-------------|
| COND-01 | Patron under item limit requests AVAILABLE item → eligible |
| COND-02 | Patron's checkout count equals max_items_checked_out → blocked |
| COND-03 | Item status in blocked_item_statuses → not eligible |
| COND-04 | Loan rule updated with non-positive values → should reject |

#### FR-5190: Requesting Rules
| Condition | Description |
|-----------|-------------|
| COND-05 | Patron's balance below max_account_balance → eligible |
| COND-06 | Patron's balance equals max_account_balance → still eligible (strict ">") |
| COND-07 | Patron's active-hold count equals max_active_holds → blocked |
| COND-08 | Ineligible request with staff_override:true and reason → placed and audited |
| COND-09 | Staff override with missing/blank override_reason → rejected 400 |

#### FR-2445: Deletion Restrictions
| Condition | Description |
|-----------|-------------|
| COND-10 | Delete bib record with 1+ ACTIVE holds → blocked 409 |
| COND-11 | Delete item on open checkout → blocked 409 |
| COND-12 | Delete item with ACTIVE hold on item_id → verify behavior |
| COND-13 | Delete bib whose items have no holds/checkouts → cascade-delete |

#### FR-5278: Suppression Rules
| Condition | Description |
|-----------|-------------|
| COND-14 | Record suppressed with scope:ALL → hidden from everyone |
| COND-15 | Record suppressed with scope:LOCATION → visible only at named location |
| COND-16 | Suppression with invalid record_type → rejected 400 |
| COND-17 | Re-suppressing already-suppressed record → verify behavior |

#### FR-6513/7302: Record Lock Management
| Condition | Description |
|-----------|-------------|
| COND-18 | Acquire lock on unlocked record → succeeds |
| COND-19 | Second staff attempts to lock already-locked record → blocked 409 |
| COND-20 | Staff with manageLocks force-unlocks active lock → succeeds |
| COND-21 | Acquire lock with negative/zero timeout_minutes → should reject |
| COND-22 | Lock exceeds timeout_minutes → excluded from active list (lazy expiry) |

#### FR-6501: System Monitoring
| Condition | Description |
|-----------|-------------|
| COND-23 | Live sampling returns CPU/memory/disk/DB metrics in valid ranges |
| COND-24 | Metric meets/exceeds threshold → alert generated at correct level |
| COND-25 | Same threshold breaches inside cooldown → duplicate suppressed |
| COND-26 | Threshold updated so warning > critical → verify handling |

#### FR-2420: Staff Account Setup
| Condition | Description |
|-----------|-------------|
| COND-27 | Create account with valid data → succeeds, password hashed, privileges merged |
| COND-28 | Username at 3-char floor → accepted; 2 chars → rejected |
| COND-29 | Password at 8-char floor → accepted; 7 chars → rejected |
| COND-30 | Create account with existing username → rejected 409 |
| COND-31 | Login with incorrect password → rejected 401, generic error |

---

### 5.4 Test Case Record (Table B) - Selected Cases

Due to space constraints, showing 5 representative test cases. Complete set of 15 test cases available in `/evidence/Testing/Test_Report_Part3B.md`.

#### TC-06: Loan Rule Update Bypasses Validation (DEFECT) ❌

| Field | Details |
|-------|---------|
| **ID / Title** | TC-06 / Verify loan rule update rejects negative values |
| **Category** | Invalid / Defect |
| **Test Basis** | Req 5057 (COND-04) - POST rejects negatives; PUT has no validation |
| **Preconditions** | Authenticated as admin (manageLoanRules) |
| **Test Data** | PUT {"max_items_checked_out":-5,"loan_period_days":-10,"renewal_limit":-1} |
| **Steps** | 1. POST valid rule (id 6)<br>2. PUT with negative values<br>3. GET rule to confirm persistence |
| **Expected** | 400 - same validation as POST |
| **Actual** | ❌ 200 - negative values written to database<br>PUT /api/loan-rules/6 → {"id":6,"max_items_checked_out":-5,...} |
| **Status** | **FAILED** ❌ |
| **Defect** | BUG-001 |

---

#### TC-10: Item Deletion Ignores Hold on Item (DEFECT) ❌

| Field | Details |
|-------|---------|
| **ID / Title** | TC-10 / Verify item deletion when hold points to item |
| **Category** | Manual E2E / Defect |
| **Test Basis** | Req 2445 (COND-12) - Checks only checkouts, never queries holds for item_id |
| **Preconditions** | None - full flow built from scratch |
| **Test Data** | New bib → item → patron → hold with item_id set |
| **Steps** | 1. Create bib, item, patron<br>2. Place hold naming specific item<br>3. Confirm hold ACTIVE with item_id<br>4. DELETE item<br>5. Re-fetch hold |
| **Expected** | 409 - deletion blocked |
| **Actual** | ❌ 200 - item deleted. Hold's item_id silently nulled, leaving ACTIVE hold pointing at nothing<br>Before: {"id":8,"item_id":6,"status":"ACTIVE"}<br>After: {"id":8,"item_id":null,"status":"ACTIVE"} |
| **Status** | **FAILED** ❌ |
| **Defect** | BUG-002 |

---

#### TC-14: Lock Acquisition Accepts Negative Timeout (DEFECT) ❌

| Field | Details |
|-------|---------|
| **ID / Title** | TC-14 / Verify lock timeout validation for negative values |
| **Category** | Invalid / Boundary / Defect |
| **Test Basis** | Req 6513/7302 (COND-21) - PUT /settings rejects <=0; acquire route has no check |
| **Preconditions** | Authenticated as admin |
| **Test Data** | {"record_type":"ITEM","record_id":9999,"timeout_minutes":-5} |
| **Steps** | 1. POST /api/locks/ with negative timeout<br>2. Immediately GET /api/locks/ to check if listed |
| **Expected** | 400 - lock can't expire before it starts |
| **Actual** | ❌ 201 - accepted with timeout:-5. On next GET, lazy-expiry auto-expired it (blast radius self-limited)<br>POST → {"id":4,"timeout_minutes":-5,"unlocked_at":null} |
| **Status** | **FAILED** ❌ |
| **Defect** | BUG-003 |

---

#### TC-05: Loan Eligibility - Exact Boundary at max_items_checked_out ✅

| Field | Details |
|-------|---------|
| **ID / Title** | TC-05 / Verify checkout rejection at exact max limit |
| **Category** | Boundary / System E2E |
| **Test Basis** | Req 5057 (COND-02) - Boundary engineered: temporary rule to force count==limit==1 |
| **Preconditions** | Alice Adult has exactly 1 open checkout |
| **Test Data** | Temporary rule: max_items_checked_out:1, priority:1 |
| **Steps** | 1. POST temporary rule<br>2. POST /api/loan-rules/evaluate for patron 1<br>3. DELETE temporary rule |
| **Expected** | currentlyCheckedOut(1) >= max(1) → not eligible |
| **Actual** | ✅ Blocked exactly at boundary<br>→ {"eligible":false,"reason":"...limit of 1...","current_items_checked_out":1} |
| **Status** | **PASSED** ✅ |

---

#### TC-15: System Monitoring - Live Metrics and Threshold ✅

| Field | Details |
|-------|---------|
| **ID / Title** | TC-15 / Verify live metrics and threshold breach alerting |
| **Category** | Normal / Boundary |
| **Test Basis** | Req 6501 (COND-23, COND-24) - Windows CPU fallback and inclusive threshold |
| **Preconditions** | None - machine's real state used |
| **Test Data** | Live OS metrics |
| **Steps** | 1. GET /api/monitoring/live<br>2. Check values sane<br>3. GET /api/monitoring/alerts<br>4. Acknowledge alert |
| **Expected** | Valid metrics; DISK_FREE_PCT at/below 10% triggers CRITICAL alert |
| **Actual** | ✅ CPU_LOAD_PCT 20.44%, MEMORY_USED_PCT 86.48%, DISK_FREE_PCT 9.6% - all sane<br>DISK_FREE_PCT 9.6% triggered CRITICAL alert (id 76)<br>Acknowledgement succeeded |
| **Status** | **PASSED** ✅ |

---

### 5.5 Traceability Record (Table C)

| Requirement | Condition | Test Case | Result | Defect |
|-------------|-----------|-----------|--------|--------|
| FR-5057 Loan rules | COND-01 | TC-04 | PASSED | — |
| FR-5057 Loan rules | COND-02 | TC-05 | PASSED | — |
| FR-5057 Loan rules | COND-04 | TC-06 | **FAILED** | **BUG-001** |
| FR-5190 Requesting rules | COND-06 | TC-07 | PASSED | — |
| FR-5190 Requesting rules | COND-07 | TC-08 | PASSED | — |
| FR-2445 Deletion restrictions | COND-10 | TC-09 | PASSED | — |
| FR-2445 Deletion restrictions | COND-12 | TC-10 | **FAILED** | **BUG-002** |
| FR-5278 Suppression rules | COND-14 | TC-11 | PASSED | — |
| FR-5278 Suppression rules | COND-15 | TC-12 | PASSED | Confirm w/ stakeholder |
| FR-6513/7302 Lock mgmt | COND-18–20 | TC-13 | PASSED | — |
| FR-6513/7302 Lock mgmt | COND-21 | TC-14 | **FAILED** | **BUG-003** |
| FR-6501 System monitoring | COND-23, COND-24 | TC-15 | PASSED | — |
| FR-2420 Staff account | COND-31 | TC-01 | PASSED | — |
| FR-2420 Staff account | COND-28 | TC-02 | PASSED | — |
| FR-2420 Staff account | COND-29 | TC-03 | PASSED | — |

---

### 5.6 Requirements Coverage Summary

| Requirement | Test Cases | Pass Rate | Status |
|-------------|------------|-----------|--------|
| FR-5057 (Loan rules) | 3 | 67% (2/3) | 1 defect (BUG-001) |
| FR-5190 (Requesting rules) | 2 | 100% (2/2) | Compliant |
| FR-2445 (Deletion restrictions) | 2 | 50% (1/2) | 1 defect (BUG-002) |
| FR-5278 (Suppression rules) | 2 | 100% (2/2) | Compliant |
| FR-6513/7302 (Lock management) | 2 | 50% (1/2) | 1 defect (BUG-003) |
| FR-6501 (System monitoring) | 1 | 100% (1/1) | Compliant |
| FR-2420 (Staff accounts) | 3 | 100% (3/3) | Compliant |
| **TOTALS** | **15** | **80%** | **3 defects** |

---

## 6. Jira Defect Reports

### 6.1 Defect Summary

**Total Defects Logged:** 3 confirmed reproducible defects  
**Jira Project:** Library Management System  
**Jira CSV Export:** `/evidence/Jira/Jira_Export.csv`

| Defect ID | Summary | Priority | Status | Test Case |
|-----------|---------|----------|--------|-----------|
| BUG-001 | PUT /api/loan-rules/:id accepts negative values that POST rejects | High | Open | TC-06 |
| BUG-002 | DELETE /api/records/items/:id succeeds even when active hold points to item | Critical | Open | TC-10 |
| BUG-003 | Lock timeout accepts negative values | Medium | Open | TC-14 |

---

### 6.2 BUG-001: Loan Rule Update Bypasses Validation

**Summary:** PUT /api/loan-rules/:id accepts negative values that POST rejects

**Priority:** High  
**Status:** Open  
**Issue Type:** Bug  
**Labels:** baseline-testing, validation-bug, data-integrity

**Description:**

Loan rule UPDATE endpoint bypasses numeric validation enforced by CREATE endpoint.

**AFFECTED ENDPOINTS:**
- PUT /api/loan-rules/:id (accepts invalid values)
- POST /api/loan-rules/ (correctly rejects invalid values)

**BASELINE VERSION:** v1.0 (commit bfe098c)

**SOURCE CODE LOCATION:**
- File: backend/src/routes/loanRules.js
- POST validation: Lines 26-28
- PUT endpoint: Lines 43-72 (missing validation)

**ISSUE:**

POST /api/loan-rules/ correctly validates:
- loan_period_days > 0
- max_items_checked_out > 0
- renewal_limit >= 0

PUT /api/loan-rules/:id applies NO such validation - accepts and persists negative values.

**STEPS TO REPRODUCE:**

1. POST /api/loan-rules/ with valid data (e.g., id 6)
   ```json
   {"name":"Test Rule","patron_type":"ADULT","loan_period_days":14,"max_items_checked_out":10,"renewal_limit":2}
   ```
2. Verify rule created (201 response)
3. PUT /api/loan-rules/6 with negative values
   ```json
   {"max_items_checked_out":-5,"loan_period_days":-10,"renewal_limit":-1}
   ```
4. Observe response
5. GET /api/loan-rules/6 to verify persisted values

**EXPECTED RESULT:**

PUT returns 400 Bad Request  
Error: "loan_period_days and max_items_checked_out must be positive; renewal_limit cannot be negative."  
No changes written to database

**ACTUAL RESULT:**

PUT returns 200 OK  
Response: `{"id":6,"max_items_checked_out":-5,"loan_period_days":-10,"renewal_limit":-1,...}`  
Negative values persisted to database  
A rule with negative loan period is now live in system

**IMPACT:**
- Data integrity compromised
- Invalid business rules can be activated
- Negative loan periods cause undefined behavior
- Same issue exists in requestingRules.js

**RECOMMENDATION:**

Add validation to PUT /api/loan-rules/:id matching POST validation:
```javascript
if (loan_period_days <= 0 || max_items_checked_out <= 0 || renewal_limit < 0) {
  return res.status(400).json({
    error: "loan_period_days and max_items_checked_out must be positive; renewal_limit cannot be negative."
  });
}
```

**REPRODUCIBILITY:** 100%  
**RELATED TEST CASE:** TC-06

**Attachments:**
- TC006_PUT_NegativeValues_Accepted.json
- TC006_GET_Persisted_NegativeValues.json

---

### 6.3 BUG-002: Item Deletion Ignores Active Holds

**Summary:** DELETE /api/records/items/:id succeeds even when active hold points to item

**Priority:** Critical  
**Status:** Open  
**Issue Type:** Bug  
**Labels:** baseline-testing, data-integrity, business-logic, holds-management

**Description:**

Item deletion endpoint checks only for open checkouts, never queries holds table for item_id. Items with active holds can be deleted, orphaning the hold.

**AFFECTED ENDPOINT:**
- DELETE /api/records/items/:id

**BASELINE VERSION:** v1.0 (commit bfe098c)

**SOURCE CODE LOCATION:**
- File: backend/src/routes/records.js
- DELETE item handler: Lines 100-122
- Issue: Only checks checkouts table, never queries holds table

**BUSINESS RULE INCONSISTENCY:**
- DELETE /api/records/bib-records/:id correctly blocks deletion when active holds exist (lines 49-71)
- DELETE /api/records/items/:id does NOT implement equivalent hold check

**ISSUE:**

When an item has an ACTIVE hold with item_id set (patron requested specific item), deletion succeeds with 200 OK. The FK constraint has ON DELETE SET NULL, so:
1. Item deleted from database
2. Hold survives with item_id silently changed to null
3. Patron left with ACTIVE hold pointing at non-existent item
4. No warning, error, or notification

**STEPS TO REPRODUCE:**

1. Create new bib record (e.g., id 10, "Test Deletion Gap Book")
2. Create new item (e.g., id 6, barcode "BC-TEST-GAP-1", status AVAILABLE)
3. Create new patron (e.g., id 6, "Gap Test Patron")
4. Place hold with item_id:
   ```json
   POST /api/records/holds
   {"patron_id":6,"bib_id":10,"item_id":6}
   ```
5. Verify hold: GET /api/records/holds/8
   ```json
   {"id":8,"patron_id":6,"bib_id":10,"item_id":6,"status":"ACTIVE"}
   ```
6. DELETE /api/records/items/6
7. Observe response (200 OK)
8. Re-fetch hold: GET /api/records/holds/8

**EXPECTED RESULT:**

Step 6 returns 409 Conflict  
Error: "Cannot delete item: it has 1 active hold. Cancel the hold first."  
Item remains in database  
Hold unchanged

**ACTUAL RESULT:**

Step 6: 200 OK `{"success":true,"message":"Item deleted."}`  
Step 8: `{"id":8,"patron_id":6,"bib_id":10,"item_id":null,"status":"ACTIVE"}`

Item deleted successfully  
Hold's item_id silently nulled by FK constraint  
Patron has ACTIVE hold for non-existent item  
No error, no audit trail

**IMPACT:**
- Critical data integrity issue
- Patron holds orphaned without notification
- Staff unaware item was requested before deletion
- Inconsistent with bib-deletion protection logic
- Violates business rule: items patrons waiting for should not disappear

**RECOMMENDATION:**

Add hold check to DELETE /api/records/items/:id before deletion:
```javascript
const holdCheck = await pool.query(
  'SELECT COUNT(*) as cnt FROM holds WHERE item_id = $1 AND status = $2',
  [itemId, 'ACTIVE']
);
if (parseInt(holdCheck.rows[0].cnt) > 0) {
  return res.status(409).json({
    error: `Cannot delete item: it has ${holdCheck.rows[0].cnt} active hold(s). Cancel the hold(s) first.`,
    blocked: true,
    active_holds: parseInt(holdCheck.rows[0].cnt)
  });
}
```

**REPRODUCIBILITY:** 100%  
**RELATED TEST CASE:** TC-10

**Attachments:**
- TC010_Hold_BeforeDeletion.json
- TC010_DELETE_ItemResponse_200.json
- TC010_Hold_AfterDeletion.json

---

### 6.4 BUG-003: Lock Acquisition Accepts Negative Timeout

**Summary:** POST /api/locks accepts negative timeout_minutes value

**Priority:** Medium  
**Status:** Open  
**Issue Type:** Bug  
**Labels:** baseline-testing, validation-bug, input-validation

**Description:**

Lock acquisition endpoint accepts negative timeout_minutes values without validation, while settings endpoint correctly rejects them.

**AFFECTED ENDPOINTS:**
- POST /api/locks/ (accepts negative timeout)
- PUT /api/locks/settings (correctly rejects <=0)

**BASELINE VERSION:** v1.0 (commit bfe098c)

**SOURCE CODE LOCATION:**
- File: backend/src/routes/locks.js
- PUT /settings validation: Lines 42-47 (correct)
- POST /locks acquisition: Line 79 (missing validation)

**VALIDATION INCONSISTENCY:**

PUT /api/locks/settings correctly validates:
```javascript
if (!minutes || minutes <= 0) {
  return res.status(400).json({
    error: "default_lock_timeout_minutes must be a positive number."
  });
}
```

POST /api/locks/ applies NO validation:
```javascript
const timeout = req.body.timeout_minutes || defaultTimeout;
// No check - accepts negative values
```

**ISSUE:**

Negative timeout values are accepted and persisted. However, blast radius is self-limited: lazy-expiry sweep (runs on every GET /api/locks/) correctly recognizes `locked_at + (-5 min) < now()` and auto-expires the lock immediately.

Still, invalid input should be rejected at entry point.

**STEPS TO REPRODUCE:**

1. Authenticate as admin
2. POST /api/locks/ with negative timeout
   ```json
   {"record_type":"ITEM","record_id":9999,"timeout_minutes":-5}
   ```
3. Observe response (201 Created)
4. Immediately GET /api/locks/ to list active locks
5. Observe lock id 4 is absent (auto-expired by lazy sweep)

**EXPECTED RESULT:**

Step 2 returns 400 Bad Request  
Error: "timeout_minutes must be a positive number."  
No lock created

**ACTUAL RESULT:**

Step 2: 201 Created  
Response: `{"id":4,"record_type":"ITEM","record_id":9999,"locked_by":1,"timeout_minutes":-5,"unlocked_at":null}`

Lock created with negative timeout  
On next GET, lazy-expiry auto-expires it (not visible in active list)  
Input validation gap exists, but impact limited by expiry mechanism

**IMPACT:**
- Input validation gap
- Inconsistent with settings endpoint validation
- Invalid data briefly persisted (until next read triggers expiry)
- Low severity due to self-correcting behavior

**RECOMMENDATION:**

Add validation to POST /api/locks/ before lock creation:
```javascript
const timeout = req.body.timeout_minutes || defaultTimeout;
if (timeout <= 0) {
  return res.status(400).json({
    error: "timeout_minutes must be a positive number."
  });
}
```

**REPRODUCIBILITY:** 100%  
**RELATED TEST CASE:** TC-14

**Attachments:**
- TC014_POST_NegativeTimeout_Accepted.json
- TC014_GET_Locks_AutoExpired.json

---

## 7. Final Quality Judgment

### 7.1 Final Quality Judgment (398 words)

The evaluated baseline (v1.0) of the Library Administration System Administration Module demonstrates **functional correctness in 80% of tested scenarios** but reveals **critical data-integrity gaps** that undermine confidence in production readiness within the evaluated 10-requirement scope.

#### What the Evidence Supports

**SonarQube analysis** identified five meaningful findings across security, maintainability, and reliability domains. The most critical finding—hardcoded database credentials (backend/src/config/db.js)—directly violates NFR-6510 (Patron data security) and represents an unacceptable security risk. Additional findings include high cognitive complexity in business-rule endpoints (requestingRules.js, complexity 18 > threshold 15), permissive CORS configuration allowing unrestricted cross-origin access, and maintainability issues (nested ternary operators). These findings confirm that while the codebase is structurally sound, **security and maintainability practices require immediate remediation** before any production deployment.

**Functional testing** of all 7 FRs across 15 test cases revealed **3 confirmed reproducible defects** (BUG-001, BUG-002, BUG-003), all representing **input validation gaps** where UPDATE/DELETE endpoints bypass the validation enforced by their corresponding CREATE endpoints. BUG-002 (item deletion ignoring active holds) is particularly severe: it allows staff to delete items patrons are actively waiting for, leaving orphaned hold records—a direct violation of FR-2445's deletion-restriction requirement. BUG-001 (loan rule updates accepting negative values) and BUG-003 (lock acquisition accepting negative timeout) demonstrate inconsistent validation logic across related endpoints. The 12 passed test cases confirm that normal-flow business rules (FR-5057, FR-5190, FR-5278, FR-6501) function correctly under expected conditions, but boundary and error-handling behavior is unreliable.

**NFR evaluation** shows **partial compliance**: NFR-6510 fails due to hardcoded credentials; NFR-5615 (real-time processing) is fully compliant with no-cache, fresh-data-per-request architecture verified through manual inspection; NFR-6511 (secure protocols) is only partially implemented (HTTPS/TLS present, but SFTP/SSH excluded from scope).

#### What Remains Unsupported

Five critical **unsupported AI assumptions** (FR-5057 loan period defaults, FR-5190 hold-limit scope, FR-6513 lock timeout default, FR-2420 account templates, NFR-6511 SFTP/SSH exclusion) introduce **unquantified risk**. Without SRS or stakeholder validation, these invented values and scope reductions may misalign with actual business requirements. The test suite does not cover bulk operations, performance under load, concurrent multi-user scenarios beyond basic lock conflict, or integration with external systems—all explicitly out of scope for this baseline evaluation.

#### Conclusion

The evaluated 10-requirement scope **cannot be considered acceptable for production use** in its current state. The combination of a critical security vulnerability (hardcoded credentials), three data-integrity defects, and five unsupported assumptions creates **excessive unmitigated risk**. However, the baseline demonstrates that the selected requirements are **implementable** and that the AI-assisted development approach produced **structurally testable code**. With remediation of the identified defects, resolution of the security finding, and stakeholder confirmation of the five unsupported assumptions, this scope could form a defensible foundation for iterative quality improvement. The evidence gathered—SonarQube findings, 15 executed test cases with 80% pass rate, and 3 confirmed Jira defects—provides a **transparent, reproducible quality baseline** for informed decision-making.

---

### 6.2 Evidence Summary Tables

#### SonarQube Findings Summary

| Finding | Type | Severity | Location | Status |
|---------|------|----------|----------|--------|
| Hardcoded Database Credentials | Security | Critical | backend/src/config/db.js | ✅ Confirmed |
| Cognitive Complexity Exceeds Threshold | Maintainability | High | backend/src/routes/requestingRules.js | ✅ Confirmed |
| Permissive CORS Configuration | Security Hotspot | Medium | backend/src/server.js | ⚠️ Requires Review |
| Form Label Accessibility Issues | Reliability | Medium | frontend/src/pages/Login.jsx | ✅ Confirmed |
| Nested Ternary Operators | Maintainability | Medium | frontend/src/pages/Suppression.jsx | ✅ Confirmed |

#### Test Execution Summary

| Metric | Value |
|--------|-------|
| Total Test Cases | 15 |
| Passed | 12 (80%) |
| Failed | 3 (20%) |
| Blocked | 0 |
| Boundary Tests | 6 |
| Invalid/Error Tests | 3 |
| Manual System-Level Tests | 7 |

#### Defect Summary

| Defect | Priority | Type | Impact |
|--------|----------|------|--------|
| BUG-001: Loan rule update accepts negatives | High | Validation Gap | Data integrity |
| BUG-002: Item deletion ignores holds | Critical | Business Logic | Data integrity, patron experience |
| BUG-003: Lock timeout accepts negatives | Medium | Validation Gap | Minor (self-correcting) |

#### NFR Compliance Summary

| NFR | Status | Compliance |
|-----|--------|------------|
| NFR-6510/6511 (Security - HTTPS/TLS/Auth) | ⚠️ Partial | Core mechanisms correct; hardcoded credentials critical issue |
| NFR-5615 (No Caching - Real-Time) | ✅ Full | Comprehensive no-cache implementation across all layers |
| NFR-6501 (System Monitoring) | ✅ Full | Monitoring, thresholds, alerts all functional |

---

## Appendices

### Appendix A: References

- **SRS Document:** Software Requirements Specification for the System Administration of an Integrated Library System (Version 3.0 final), January 28, 2009, Prepared by Lori Ayre and Lucien Kress, Galecia Group
- **GitHub Repository:** https://github.com/Malaikaa0/SQE_ASSIGNMET
- **SonarQube Documentation:** https://docs.sonarqube.org/
- **WCAG 2.1 Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/

### Appendix B: File Locations

**Evidence Files:**
- Part 1 Requirements: `/evidence/Part1_Requirements/Part1-Requirement-Scope-AI-Assumptions.md`
- SonarQube Report: `/evidence/SonarQube_Analysis/SonarQube_Quality_Report.md`
- SonarQube Screenshots: `/evidence/SonarQube_Analysis/*.png` (13 files)
- Test Report: `/evidence/Testing/Test_Report_Part3B.md`
- Test Cases: `/evidence/Testing/Test_Cases_Only.md`
- JSON Evidence: `/evidence/Testing/JSON_Evidence/*.json` (7 files)
- Jira CSV: `/evidence/Jira/Jira_Export.csv`
- Jira Screenshots: `/evidence/Jira/Screenshots/*.png` (7 files)
- Final Judgment: `/evidence/Part4_Final_Judgment/Part4-Final-Quality-Judgment.md`

**Code Files:**
- Backend Source: `/backend/src/`
- Frontend Source: `/frontend/src/`
- Database Schema: `/backend/src/db/schema.sql`
- Seed Data: `/backend/src/db/seed.js`

### Appendix C: Test Environment Details

| Component | Details |
|-----------|---------|
| Operating System | Linux 7.0.0-31-generic (Ubuntu) |
| Node.js | v24.x |
| PostgreSQL | 14.x (Docker container, port 5000) |
| Backend Server | https://localhost:8443 (Express.js + HTTPS) |
| Frontend Server | http://localhost:5173 (Vite dev server) |
| Browser Tested | Chrome 118.x |
| Test Execution Period | September 11, 2026, 17:00 - 22:30 |

---

**End of Assignment Report**

**Submitted by:**  
Malaika i24-3098  
Rehan Ahmed i24-3012

**Date:** September 12, 2026  
**Course:** SE3002 – Software Quality Engineering
