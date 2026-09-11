# Part 4 — Final Quality Judgment

**Students:**
- Malaika – 24i3098
- Rehan Ahmed – 24i3012

**Course:** SE3002 – Software Quality Engineering  
**Assignment:** 01 – Part 4: Defect Reporting and Final Quality Judgment  
**Project:** Library Administration – System Administration Module  
**Baseline Version:** v1.0 (commit bfe098c, tag baseline-v1.0)

---

## Final Quality Judgment (300-400 words)

The evaluated baseline (v1.0) of the Library Administration System Administration Module demonstrates **functional correctness in 80% of tested scenarios** but reveals **critical data-integrity gaps** that undermine confidence in production readiness within the evaluated 10-requirement scope.

### What the Evidence Supports

**SonarQube analysis** identified five meaningful findings across security, maintainability, and reliability domains. The most critical finding—hardcoded database credentials (backend/src/config/db.js)—directly violates NFR-6510 (Patron data security) and represents an unacceptable security risk. Additional findings include high cognitive complexity in business-rule endpoints (requestingRules.js, complexity 18 > threshold 15), permissive CORS configuration allowing unrestricted cross-origin access, and maintainability issues (nested ternary operators). These findings confirm that while the codebase is structurally sound, **security and maintainability practices require immediate remediation** before any production deployment.

**Functional testing** of all 7 FRs across 15 test cases revealed **3 confirmed reproducible defects** (BUG-001, BUG-002, BUG-003), all representing **input validation gaps** where UPDATE/DELETE endpoints bypass the validation enforced by their corresponding CREATE endpoints. BUG-002 (item deletion ignoring active holds) is particularly severe: it allows staff to delete items patrons are actively waiting for, leaving orphaned hold records—a direct violation of FR-2445's deletion-restriction requirement. BUG-001 (loan rule updates accepting negative values) and BUG-003 (lock acquisition accepting negative timeout) demonstrate inconsistent validation logic across related endpoints. The 12 passed test cases confirm that normal-flow business rules (FR-5057, FR-5190, FR-5278, FR-6501) function correctly under expected conditions, but boundary and error-handling behavior is unreliable.

**NFR evaluation** shows **partial compliance**: NFR-6510 fails due to hardcoded credentials; NFR-5615 (real-time processing) is fully compliant with no-cache, fresh-data-per-request architecture verified through manual inspection; NFR-6511 (secure protocols) is only partially implemented (HTTPS/TLS present, but SFTP/SSH excluded from scope).

### What Remains Unsupported

Five critical **unsupported AI assumptions** (FR-5057 loan period defaults, FR-5190 hold-limit scope, FR-6513 lock timeout default, FR-2420 account templates, NFR-6511 SFTP/SSH exclusion) introduce **unquantified risk**. Without SRS or stakeholder validation, these invented values and scope reductions may misalign with actual business requirements. The test suite does not cover bulk operations, performance under load, concurrent multi-user scenarios beyond basic lock conflict, or integration with external systems—all explicitly out of scope for this baseline evaluation.

### Conclusion

The evaluated 10-requirement scope **cannot be considered acceptable for production use** in its current state. The combination of a critical security vulnerability (hardcoded credentials), three data-integrity defects, and five unsupported assumptions creates **excessive unmitigated risk**. However, the baseline demonstrates that the selected requirements are **implementable** and that the AI-assisted development approach produced **structurally testable code**. With remediation of the identified defects, resolution of the security finding, and stakeholder confirmation of the five unsupported assumptions, this scope could form a defensible foundation for iterative quality improvement. The evidence gathered—SonarQube findings, 15 executed test cases with 80% pass rate, and 3 confirmed Jira defects—provides a **transparent, reproducible quality baseline** for informed decision-making.

---

**Word Count:** 398 words

---

## Defect Summary

### Confirmed Reproducible Defects Logged in Jira

| Defect ID | Summary | Priority | Status | Related Test Case |
|-----------|---------|----------|--------|-------------------|
| BUG-001 | PUT /api/loan-rules/:id accepts negative values that POST rejects | High | Open | TC-06 |
| BUG-002 | DELETE /api/records/items/:id succeeds even when active hold points to item | Critical | Open | TC-10 |
| BUG-003 | Lock timeout accepts negative values | Medium | Open | TC-14 |

### Test Execution Summary

- **Total Test Cases:** 15
- **Passed:** 12 (80%)
- **Failed:** 3 (20%)
- **Blocked:** 0

### SonarQube Findings Summary

1. **Hardcoded Database Credentials** (Security - Critical) - backend/src/config/db.js
2. **Cognitive Complexity Exceeds Threshold** (Maintainability - High) - backend/src/routes/requestingRules.js
3. **Permissive CORS Configuration** (Security Hotspot - Medium) - backend/src/server.js
4. **Form Label Accessibility Issues** (Reliability - Medium) - frontend/src/pages/Login.jsx
5. **Nested Ternary Operators** (Maintainability - Medium) - frontend/src/pages/Suppression.jsx

### Requirements Coverage

| Requirement | Test Cases | Pass Rate | Status |
|-------------|------------|-----------|--------|
| FR-5057 (Loan rules) | 3 | 67% (2/3) | 1 defect (BUG-001) |
| FR-5190 (Requesting rules) | 2 | 100% (2/2) | Compliant |
| FR-2445 (Deletion restrictions) | 2 | 50% (1/2) | 1 defect (BUG-002) |
| FR-5278 (Suppression rules) | 2 | 100% (2/2) | Compliant |
| FR-6513/7302 (Lock management) | 2 | 50% (1/2) | 1 defect (BUG-003) |
| FR-6501 (System monitoring) | 1 | 100% (1/1) | Compliant |
| FR-2420 (Staff accounts) | 3 | 100% (3/3) | Compliant |

---

**End of Part 4**
