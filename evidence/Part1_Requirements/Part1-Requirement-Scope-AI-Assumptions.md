# Part 1 — Requirement Scope and AI Assumptions

**Students:**
- Malaika – 24i3098
- Rehan Ahmed – 24i3012

**Course:** SE3002 – Software Quality Engineering  
**Assignment:** 01 – Part 1: Requirement Scope and AI Assumptions  
**Project:** Library Administration – System Administration Module

---

## 1. Selected SRS

**Title:** Software Requirements Specification for the System Administration of an Integrated Library System (Version 3.0 final)

**Prepared by:** Lori Ayre and Lucien Kress, Galecia Group

**Date:** January 28, 2009

**Scope note:** This SRS covers the System Administration Module of a King County Library System Integrated Library System (ILS) – i.e. server, database, account, security, monitoring, and reporting administration. It explicitly excludes Circulation, Acquisitions, Cataloging, and OPAC/patron-facing modules, which are separate SRS documents.

---

## 2. Requirement Scope (7 FR + 3 NFR)

The following table lists the 10 selected requirements (7 Functional, 3 Non-Functional), preserving original SRS requirement IDs and wording. Only one of the seven FRs (Staff account setup, 2420) is a CRUD-type requirement, in compliance with the 3-CRUD limit.

| Req. ID | Type | Requirement (brief) | Why selected / risk | AI assumption | Defence / basis |
|---------|------|---------------------|---------------------|---------------|-----------------|
| **5057** | FR | Loan rules – system allows creation/modification of rules that allow or disallow check-out, calculate loan periods, and determine renewal limits based on patron type, item status, and other criteria. | Selected because it represents core business-rule logic (not CRUD) with clear, testable boundaries (e.g. max renewals, unavailable item status). Risk: incorrect rule evaluation could allow checkout of restricted items. | AI assumed a fixed default loan period (14 days) and a fixed renewal limit (3) since the SRS does not specify exact numeric values. | **unsupported** |
| **5190** | FR | Requesting rules – system allows creation/modification of rules determining whether a patron can place a hold on an item, evaluating patron type, current holds, account balance, and item status. | Selected for meaningful conditional/permission logic and staff-override behaviour. Risk: incorrect precedence between patron-level and item-level rules. | AI assumed hold limits are enforced per patron account rather than per branch, since the SRS does not specify scope. | **unsupported** |
| **2445** | FR | Business rules – system supports restrictions based on business rules, e.g. restricting deletion of item records that are checked out, or bibliographic records with existing holds. | Selected as a validation/decision requirement that directly prevents data-integrity violations. Risk: deletion restriction logic may be bypassed via indirect operations (e.g. bulk delete). | AI assumed only two restriction conditions (checked-out status, existing holds) should be enforced, since the SRS gives these only as examples ('e.g.'). | **design decision** |
| **5278** | FR | Suppression rules – customizable rules specifying whether patrons and staff can view authority, bibliographic, order, and item records in staff and public interfaces. | Selected for its role-based visibility logic across multiple interfaces. Risk: incorrect suppression scope could expose restricted records to patrons. | AI assumed three visibility levels (specific workgroup, specific location, all staff/patrons) as stated in the SRS, and did not add extra levels. | **SRS** |
| **6513 / 7302** | FR | Record lock management – staff can identify where a patron/item record is in use (location, user, time) and unlock one or more locked records from a single console. | Selected as a complete workflow (view + unlock) counted as one FR, involving concurrency-aware state management. Risk: unlocking a record mid-edit by another user could cause data loss. | AI assumed a fixed lock timeout threshold (15 minutes) since the SRS requires a configurable threshold but does not specify a default. | **unsupported** |
| **6501** | FR | System monitoring – system monitors resources (disk, CPU, memory, processes, interfaces) with configurable alert thresholds sent via dashboard, email, and text message. | Selected for threshold-based decision logic and multi-channel alerting behaviour. Risk: incorrect threshold logic could cause missed or excessive alerts. | AI assumed dashboard and email alert channels only were implemented; SMS/text alerting was treated as out of scope due to third-party SMS gateway cost/complexity. | **design decision** |
| **2420** | FR | Staff account setup – dedicated interface for creating new staff accounts with configurable templates and granular privileges for creation, modification, and deletion. | Selected as the pair's single CRUD-type requirement (within the 3-CRUD limit), needed as the foundation for role/privilege-based access used by other FRs. Risk: privilege assignment errors could grant excess access. | AI assumed a fixed set of three account templates (Admin, System Administrator, General Staff) since the SRS requires templates but does not enumerate them. | **unsupported** |
| **6510** | NFR | Patron data security – patron data is secure in all transfers to and from the system. | Selected as a directly testable security NFR relevant to every module that handles patron data. | AI assumed HTTPS/TLS in transit and hashed storage for sensitive fields as the implementation of 'secure', since the SRS does not define the mechanism. | **design decision** |
| **6511** | NFR | Secure protocol support – system supports secure protocols including SFTP, SSL, and SSH, with SFTP supported in active and passive modes. | Selected as a concrete, inspectable security requirement with explicit protocol names, allowing direct verification in configuration/code. | AI assumed only SSL/TLS was implemented for the web application layer; SFTP/SSH support was treated as out of scope for this baseline since no file-transfer feature was selected. | **unsupported** |
| **5615** | NFR | Real-time processing – the system provides real-time processing, e.g. pull lists and reports reflect current data at the time of viewing. | Selected as a testable performance NFR directly tied to data freshness and responsiveness of the selected FRs. | AI assumed 'real-time' means data is fetched fresh from the database on every request (no caching layer), since the SRS gives no explicit response-time threshold. | **design decision** |

---

## 3. AI Assumption Basis – Summary

Each material assumption introduced during AI-assisted development is classified below as (a) supported by the SRS, (b) justified by an explicit design decision, or (c) unsupported. Unsupported assumptions are disclosed rather than hidden, per assignment requirements.

### (a) Supported by the SRS

1. **5278 – Suppression rules:** The three visibility levels used match those explicitly listed in the SRS text.

### (b) Justified by an explicit design decision

1. **2445 – Business rules:** Restricted the enforced conditions to the two examples given in the SRS ('e.g.'), treated as a representative, extensible set.

2. **6501 – System monitoring:** SMS/text alerting excluded from the baseline due to third-party gateway cost/complexity; dashboard and email channels implemented instead.

3. **6510 – Patron data security:** HTTPS/TLS in transit and hashed storage chosen as the concrete mechanism for the SRS's general 'secure' requirement.

4. **5615 – Real-time processing:** Implemented as no-cache, fresh-fetch-per-request, since the SRS specifies the behaviour but not a numeric response-time threshold.

### (c) Unsupported

1. **5057 – Loan rules:** Default loan period (14 days) and renewal limit (3) are invented values with no SRS or documented basis.

2. **5190 – Requesting rules:** Hold-limit scope assumed per-patron-account rather than per-branch, with no SRS basis.

3. **6513 / 7302 – Record lock management:** Fixed 15-minute lock timeout is an invented default.

4. **2420 – Staff account setup:** The three named account templates (Admin, System Administrator, General Staff) are invented; the SRS requires templates but does not name any.

5. **6511 – Secure protocol support:** SFTP/SSH support was dropped from the baseline entirely without an explicit, documented design justification.

---

## 4. Notes on Requirement Selection

Six of the seven selected FRs (5057, 5190, 2445, 5278, 6513/7302, 6501) represent business rules, validation logic, permissions, or workflows rather than plain data management, satisfying the requirement that FRs beyond the CRUD allowance reflect meaningful behaviour. 

The three NFRs (6510, 6511, 5615) were selected because they are independently testable through a combination of SonarQube evidence (security-related findings) and targeted manual/structural testing (real-time data freshness), consistent with Part 3A of the assignment.

---

**End of Part 1**
