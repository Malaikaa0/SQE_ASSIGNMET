# Test Cases - Library Administration System

**System Under Test:** Library Administration System - Backend API  
**Version:** Baseline v1.0 (commit bfe098c)  
**Test Environment:** https://localhost:8443  
**Execution Date:** September 11, 2026

---

## TC-01: Staff Login - Valid and Invalid Credentials

| Field | Details |
|-------|---------|
| **ID / Title** | TC-01 / Verify authentication with valid and invalid credentials |
| **Level / Category** | System / Manual E2E / Normal / Invalid |
| **Test Basis / Objective** | Req 2420 (COND-27, COND-31) - Confirms auth gate every test depends on |
| **Preconditions** | Seeded account admin/Admin123! exists |
| **Test Data** | Valid: {"username":"admin","password":"Admin123!"}<br>Invalid: same username, wrong password |
| **Steps** | 1. POST /api/auth/login with valid credentials<br>2. Decode JWT and confirm privilege set<br>3. POST /api/auth/login with wrong password |
| **Expected Result** | Step 1: 200 with JWT<br>Step 3: 401 with generic message |
| **Actual Result** | ✅ 200 with full privilege set, 8h expiry<br>401 generic error matches expected |
| **Status** | **PASSED** |

---

## TC-02: Staff Creation - Username Length Boundary

| Field | Details |
|-------|---------|
| **ID / Title** | TC-02 / Verify username length boundary at 3 characters |
| **Level / Category** | Boundary / Invalid |
| **Test Basis / Objective** | Req 2420 (COND-28) - USERNAME_RE floor is boundary under test |
| **Preconditions** | Authenticated as admin |
| **Test Data** | username:"abc" (3 chars) vs username:"ab" (2 chars) |
| **Steps** | 1. POST /api/staff/ with 3-character username<br>2. POST /api/staff/ with 2-character username |
| **Expected Result** | 3 chars → 201<br>2 chars → 400 |
| **Actual Result** | ✅ Exactly as expected on both sides |
| **Status** | **PASSED** |

---

## TC-03: Staff Creation - Password Length Boundary

| Field | Details |
|-------|---------|
| **ID / Title** | TC-03 / Verify password length boundary at 8 characters |
| **Level / Category** | Boundary / Invalid |
| **Test Basis / Objective** | Req 2420 (COND-29) - password.length < 8 validation |
| **Preconditions** | Authenticated as admin |
| **Test Data** | "Abcdefg1" (8 chars) vs "Abcdef1" (7 chars) |
| **Steps** | 1. POST /api/staff/ with 8-character password<br>2. POST /api/staff/ with 7-character password |
| **Expected Result** | 8 chars → 201<br>7 chars → 400 |
| **Actual Result** | ✅ Exactly as expected on both sides |
| **Status** | **PASSED** |

---

## TC-04: Loan Eligibility - Normal Case

| Field | Details |
|-------|---------|
| **ID / Title** | TC-04 / Verify normal loan eligibility |
| **Level / Category** | Normal |
| **Test Basis / Objective** | Req 5057 (COND-01) - Baseline eligibility path |
| **Preconditions** | Alice Adult (patron 1, 1 checkout), item 1 AVAILABLE |
| **Test Data** | {"patron_id":1,"item_id":1} |
| **Steps** | 1. POST /api/loan-rules/evaluate |
| **Expected Result** | Eligible, rule "Adult standard" applied, count 1 < 15 |
| **Actual Result** | ✅ Matched expected exactly<br>→ 200 {"eligible":true,"rule_applied":"Adult standard",...} |
| **Status** | **PASSED** |

---

## TC-05: Loan Eligibility - Exact Boundary at max_items_checked_out

| Field | Details |
|-------|---------|
| **ID / Title** | TC-05 / Verify checkout rejection at exact max limit |
| **Level / Category** | Boundary / System E2E |
| **Test Basis / Objective** | Req 5057 (COND-02) - Boundary engineered: temporary rule to force count==limit==1 |
| **Preconditions** | Alice Adult has exactly 1 open checkout |
| **Test Data** | Temporary rule: max_items_checked_out:1, priority:1 |
| **Steps** | 1. POST temporary loan rule<br>2. POST /api/loan-rules/evaluate for patron 1<br>3. DELETE temporary rule |
| **Expected Result** | currentlyCheckedOut(1) >= max(1) → not eligible |
| **Actual Result** | ✅ Blocked exactly at boundary<br>→ 200 {"eligible":false,"reason":"...limit of 1...","current_items_checked_out":1} |
| **Status** | **PASSED** |

---

## TC-06: Loan Rule Update Bypasses Validation (DEFECT)

| Field | Details |
|-------|---------|
| **ID / Title** | TC-06 / Verify loan rule update rejects negative values |
| **Level / Category** | Invalid / Defect |
| **Test Basis / Objective** | Req 5057 (COND-04) - POST rejects negatives; PUT has no equivalent check |
| **Preconditions** | Authenticated as admin |
| **Test Data** | PUT {"max_items_checked_out":-5,"loan_period_days":-10,"renewal_limit":-1} |
| **Steps** | 1. POST valid rule (id 6)<br>2. PUT with negative values<br>3. GET rule back to confirm persisted |
| **Expected Result** | 400 - same validation as POST |
| **Actual Result** | ❌ **FAILED**<br>200 - negative values written to database<br>PUT → 200 {"id":6,"max_items_checked_out":-5,"loan_period_days":-10,...} |
| **Status** | **FAILED** ❌ |
| **Defect Report** | BUG-001 |

---

## TC-07: Hold Eligibility - Exact Boundary at max_account_balance

| Field | Details |
|-------|---------|
| **ID / Title** | TC-07 / Verify hold eligibility at exact balance limit |
| **Level / Category** | Boundary |
| **Test Basis / Objective** | Req 5190 (COND-06) - Strict ">" means equal to cap must pass |
| **Preconditions** | Default rule caps max_account_balance at $10.00 |
| **Test Data** | New patron with balance exactly $10.00, hold target bib 3 |
| **Steps** | 1. Create patron with balance $10.00<br>2. POST /api/requesting-rules/evaluate |
| **Expected Result** | Eligible - $10.00 not greater than $10.00 |
| **Actual Result** | ✅ Eligible, hold persisted<br>→ 200 {"eligible":true,"rule_applied":"Default fallback holds",...} |
| **Status** | **PASSED** |

---

## TC-08: Hold Eligibility - Exact Boundary at max_active_holds

| Field | Details |
|-------|---------|
| **ID / Title** | TC-08 / Verify hold rejection at exact holds limit |
| **Level / Category** | Boundary / Manual E2E / System |
| **Test Basis / Objective** | Req 5190 (COND-07) - Built real holds until count hit exact limit |
| **Preconditions** | Jamie Juvenile starts with 1 hold. Rule: max_active_holds:5 |
| **Test Data** | Four sequential evaluate calls, then fifth once count is 5 |
| **Steps** | 1-3. Place holds #2-5<br>4. Attempt 6th hold with count at 5 |
| **Expected Result** | Holds 2-5 succeed<br>6th rejected (activeHolds(5) >= max(5)) |
| **Actual Result** | ✅ All five placed successfully; sixth rejected<br>6th call → 200 {"eligible":false,"failed_checks":["...5 active hold(s)..."]} |
| **Status** | **PASSED** |

---

## TC-09: Bib Record Deletion Blocked by Active Hold

| Field | Details |
|-------|---------|
| **ID / Title** | TC-09 / Verify bib deletion blocked when active holds exist |
| **Level / Category** | Normal / Manual E2E |
| **Test Basis / Objective** | Req 2445 (COND-10) - Counts ACTIVE holds and refuses deletion |
| **Preconditions** | Bib 2 carries real seeded ACTIVE hold |
| **Test Data** | DELETE /api/records/bib-records/2 |
| **Steps** | 1. Login as admin<br>2. Attempt deletion<br>3. Confirm record still exists |
| **Expected Result** | 409, deletion refused, hold count in message |
| **Actual Result** | ✅ Refused as expected<br>→ 409 {"error":"...has 1 active hold(s)...","blocked":true} |
| **Status** | **PASSED** |

---

## TC-10: Item Deletion Ignores Hold on Item (DEFECT)

| Field | Details |
|-------|---------|
| **ID / Title** | TC-10 / Verify item deletion when hold points to item |
| **Level / Category** | Manual E2E / Defect |
| **Test Basis / Objective** | Req 2445 (COND-12) - Checks only checkouts, never queries holds for item_id |
| **Preconditions** | None - full flow built from scratch |
| **Test Data** | New bib → new item → new patron → hold with item_id set |
| **Steps** | 1. Create bib, item, patron<br>2. Place hold naming specific item<br>3. Confirm hold ACTIVE with item_id<br>4. DELETE item<br>5. Re-fetch hold |
| **Expected Result** | 409 - deletion blocked (item patron waiting on shouldn't disappear) |
| **Actual Result** | ❌ **FAILED**<br>200 - item deleted. Hold's item_id silently nulled by FK, leaving ACTIVE hold pointing at nothing<br>Before: {"id":8,"item_id":6,"status":"ACTIVE",...}<br>After: {"id":8,"item_id":null,"status":"ACTIVE",...} |
| **Status** | **FAILED** ❌ |
| **Defect Report** | BUG-002 |

---

## TC-11: Suppression - Global Scope

| Field | Details |
|-------|---------|
| **ID / Title** | TC-11 / Verify global suppression hides record universally |
| **Level / Category** | Normal |
| **Test Basis / Objective** | Req 5278 (COND-14) - scope:ALL is unconditional |
| **Preconditions** | Bib 3 exists and visible |
| **Test Data** | {"record_type":"BIB","record_id":3,"scope":"ALL"} |
| **Steps** | 1. POST suppression rule<br>2. Check visibility as non-staff viewer |
| **Expected Result** | Not visible to any viewer |
| **Actual Result** | ✅ Matched<br>→ 200 {"visible":false,"reason":"...suppressed from all..."} |
| **Status** | **PASSED** |

---

## TC-12: Suppression - LOCATION Scope as Allow-List

| Field | Details |
|-------|---------|
| **ID / Title** | TC-12 / Verify LOCATION scope visibility behavior |
| **Level / Category** | Business Rule / Manual E2E |
| **Test Basis / Objective** | Req 5278 (COND-15) - LOCATION scope as documented assumption |
| **Preconditions** | Bib 1 exists |
| **Test Data** | {"scope":"LOCATION","location":"BRANCH_A"} |
| **Steps** | 1. POST LOCATION-scoped rule<br>2. Check from BRANCH_A viewer<br>3. Check from MAIN viewer |
| **Expected Result** | Visible at BRANCH_A, hidden at MAIN |
| **Actual Result** | ✅ Matched coded assumption (flag for stakeholder: reads as allow-list)<br>BRANCH_A: {"visible":true,...}<br>MAIN: {"visible":false,...} |
| **Status** | **PASSED** |

---

## TC-13: Record Lock - Full Lifecycle

| Field | Details |
|-------|---------|
| **ID / Title** | TC-13 / Verify complete lock lifecycle |
| **Level / Category** | Normal / Manual E2E / System |
| **Test Basis / Objective** | Req 6513/7302 (COND-18-20) - Full lock flow |
| **Preconditions** | Logged in as admin and circsuper (both hold manageLocks) |
| **Test Data** | {"record_type":"BIB_RECORD","record_id":1} |
| **Steps** | 1. Admin: Acquire lock<br>2. Circsuper: Attempt lock<br>3. Circsuper: Force-unlock<br>4. Circsuper: Re-acquire |
| **Expected Result** | Step 1: 201<br>Step 2: 409 naming holder<br>Step 3: 200<br>Step 4: 201 |
| **Actual Result** | ✅ All four steps matched<br>Step 2: 409 {"error":"...locked by admin..."}<br>Step 3: 200 {"success":true,...}<br>Step 4: 201 {...,"locked_by":2} |
| **Status** | **PASSED** |

---

## TC-14: Lock Acquisition Accepts Negative Timeout (DEFECT)

| Field | Details |
|-------|---------|
| **ID / Title** | TC-14 / Verify lock timeout validation for negative values |
| **Level / Category** | Invalid / Boundary / Defect |
| **Test Basis / Objective** | Req 6513/7302 (COND-21) - PUT /settings rejects <=0; acquire route has no check |
| **Preconditions** | Authenticated as admin |
| **Test Data** | {"record_type":"ITEM","record_id":9999,"timeout_minutes":-5} |
| **Steps** | 1. POST /api/locks/ with negative timeout<br>2. GET /api/locks/ to check if listed as active |
| **Expected Result** | 400 - lock can't expire before it starts |
| **Actual Result** | ❌ **FAILED**<br>201 - accepted with timeout:-5. On next GET, lazy-expiry auto-expired it (blast radius self-limited)<br>POST → 201 {"id":4,"timeout_minutes":-5,"unlocked_at":null,...}<br>Next GET → lock id 4 absent |
| **Status** | **FAILED** ❌ |
| **Defect Report** | BUG-003 |

---

## TC-15: System Monitoring - Live Metrics and Threshold

| Field | Details |
|-------|---------|
| **ID / Title** | TC-15 / Verify live metrics and threshold breach alerting |
| **Level / Category** | Normal / Boundary |
| **Test Basis / Objective** | Req 6501 (COND-23, COND-24) - Windows CPU fallback and inclusive threshold |
| **Preconditions** | None - machine's real state used |
| **Test Data** | Live OS metrics |
| **Steps** | 1. GET /api/monitoring/live<br>2. Check values sane<br>3. GET /api/monitoring/alerts<br>4. Acknowledge alert |
| **Expected Result** | Valid metrics; DISK_FREE_PCT at/below 10% triggers CRITICAL alert |
| **Actual Result** | ✅ CPU_LOAD_PCT 20.44%, MEMORY_USED_PCT 86.48%, DISK_FREE_PCT 9.6% - all sane<br>DISK_FREE_PCT 9.6% triggered CRITICAL alert (id 76)<br>Acknowledgement succeeded |
| **Status** | **PASSED** |

---

## Summary

| Status | Count | Percentage |
|--------|-------|------------|
| PASSED | 12 | 80% |
| FAILED | 3 | 20% |
| **TOTAL** | **15** | **100%** |

**Failed Test Cases:**
- TC-06: Loan rule update bypasses validation (BUG-001)
- TC-10: Item deletion ignores holds on item (BUG-002)
- TC-14: Lock acquisition accepts negative timeout (BUG-003)
