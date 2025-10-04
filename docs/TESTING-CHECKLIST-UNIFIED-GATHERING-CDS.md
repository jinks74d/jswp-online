# Testing Checklist: Unified Gathering CDs Form

## POC Status: ✅ Ready for QA Testing

This document provides a comprehensive testing checklist for the unified Gathering CDs form proof of concept.

---

## Pre-Testing Setup

### 1. Enable Feature Flag

**File:** `.env.local`

```bash
# Change from false to true to enable unified form
USE_UNIFIED_GATHERING_CDS_FORM=true
```

**Restart server after changing:**
```bash
npm run dev
```

### 2. Disable Feature Flag (Rollback)

```bash
# Change back to false to use legacy forms
USE_UNIFIED_GATHERING_CDS_FORM=false
```

---

## Test Matrix: All Writing Styles

Test **ALL 4 writing styles** with the unified component:

### ✅ Argumentation Tests

| Test # | Action | Expected Result | Pass/Fail |
|--------|--------|----------------|-----------|
| ARG-1 | Create argumentation assignment | Assignment created | ☐ |
| ARG-2 | Navigate to Gathering CDs page | Unified form loads | ☐ |
| ARG-3 | Add 5 CDs to Chunk 1 | CDs appear in list | ☐ |
| ARG-4 | Select 2 CDs (multi-select) | 2 CDs highlighted | ☐ |
| ARG-5 | Select 4 CDs (multi-select) | 4 CDs highlighted | ☐ |
| ARG-6 | Try to select 5 CDs | Should allow (validation on submit) | ☐ |
| ARG-7 | Submit with 1 CD selected | Error: "Please select at least 2 CDs" | ☐ |
| ARG-8 | Submit with 5 CDs selected | Error: "Please select no more than 4 CDs" | ☐ |
| ARG-9 | Submit with 3 CDs selected | Success, navigates to `/shaping` | ☐ |
| ARG-10 | Drag and drop CDs | Order changes, selections preserved | ☐ |
| ARG-11 | Auto-save indicator | Shows "Saving..." then "Saved" | ☐ |
| ARG-12 | Reload page | Previous CDs and selections load | ☐ |
| ARG-13 | Click help icon | Modal shows argumentation-specific tips | ☐ |

### ✅ Expository Tests

| Test # | Action | Expected Result | Pass/Fail |
|--------|--------|----------------|-----------|
| EXP-1 | Create expository assignment | Assignment created | ☐ |
| EXP-2 | Navigate to Gathering CDs page | Unified form loads | ☐ |
| EXP-3 | Add 6 CDs to Chunk 1 | CDs appear in list | ☐ |
| EXP-4 | Select 3 CDs (multi-select) | 3 CDs highlighted | ☐ |
| EXP-5 | Submit with 3 CDs selected | Success, navigates to `/working-topic-sentence` | ☐ |
| EXP-6 | Verify next step route | Correct route for expository | ☐ |
| EXP-7 | Auto-save works | Data persists | ☐ |
| EXP-8 | Click help icon | Modal shows expository-specific tips | ☐ |

### ✅ Narrative Tests

| Test # | Action | Expected Result | Pass/Fail |
|--------|--------|----------------|-----------|
| NAR-1 | Create narrative assignment | Assignment created | ☐ |
| NAR-2 | Navigate to Gathering CDs page | Unified form loads | ☐ |
| NAR-3 | Add 4 CDs to Chunk 1 | CDs appear in list | ☐ |
| NAR-4 | Select 2 CDs (multi-select) | 2 CDs highlighted | ☐ |
| NAR-5 | Submit with 2 CDs selected | Success, navigates to `/shaping-1` | ☐ |
| NAR-6 | Verify next step route | Correct route for narrative | ☐ |
| NAR-7 | Click help icon | Modal shows narrative-specific tips | ☐ |

### ✅ Literary Tests (CRITICAL - Single Select Mode)

| Test # | Action | Expected Result | Pass/Fail |
|--------|--------|----------------|-----------|
| LIT-1 | Create literary assignment | Assignment created | ☐ |
| LIT-2 | Navigate to Gathering CDs page | Unified form loads | ☐ |
| LIT-3 | Add 5 CDs to Chunk 1 | CDs appear in list | ☐ |
| LIT-4 | Click CD #1 | CD #1 selected (radio behavior) | ☐ |
| LIT-5 | Click CD #3 | CD #3 selected, CD #1 deselected | ☐ |
| LIT-6 | Try to select multiple | Only 1 CD selected at a time | ☐ |
| LIT-7 | Submit with 1 CD selected | Success, navigates to `/commentary` | ☐ |
| LIT-8 | Submit with 0 CDs selected | Error: "Please select a CD" | ☐ |
| LIT-9 | Verify next step route | Correct route for literary | ☐ |
| LIT-10 | Click help icon | Modal shows literary-specific tips | ☐ |

---

## Regression Tests: Cross-Cutting Features

### Auto-Save

| Test # | Feature | Expected Result | Pass/Fail |
|--------|---------|----------------|-----------|
| AS-1 | Add CD, wait 1 second | "Saving..." appears | ☐ |
| AS-2 | After save completes | "Saved" appears for 2 seconds | ☐ |
| AS-3 | Close browser, reopen | Data persists | ☐ |
| AS-4 | Test all 4 writing styles | Auto-save works for all | ☐ |

### Drag and Drop

| Test # | Feature | Expected Result | Pass/Fail |
|--------|---------|----------------|-----------|
| DND-1 | Drag CD from position 1 to 3 | Order changes | ☐ |
| DND-2 | Drag while CD is selected (multi) | Selection follows CD | ☐ |
| DND-3 | Drag while CD is selected (single) | Selection follows CD | ☐ |
| DND-4 | Test all 4 writing styles | Drag works for all | ☐ |

### Chunk 2

| Test # | Feature | Expected Result | Pass/Fail |
|--------|---------|----------------|-----------|
| CH2-1 | Select 2 chunks in previous step | Chunk 2 section appears | ☐ |
| CH2-2 | Add CDs to Chunk 2 | CDs added successfully | ☐ |
| CH2-3 | Select CDs in Chunk 2 | Selection works independently | ☐ |
| CH2-4 | Submit with valid Chunk 2 data | Success | ☐ |
| CH2-5 | Submit without Chunk 2 CDs when required | Validation error | ☐ |

### UI Elements

| Test # | Feature | Expected Result | Pass/Fail |
|--------|---------|----------------|-----------|
| UI-1 | Correct style icon appears | Arg/Exp/Narr/Lit icon | ☐ |
| UI-2 | Page title correct | Writing style-specific title | ☐ |
| UI-3 | Instruction text correct | Writing style-specific text | ☐ |
| UI-4 | Button labels correct | Config-driven labels | ☐ |
| UI-5 | Help modal content correct | Style-specific tips | ☐ |
| UI-6 | Due date indicator | Shows correct colors | ☐ |
| UI-7 | Assignment status | Shows 17% progress | ☐ |

---

## Performance Tests

| Test # | Metric | Expected | Pass/Fail |
|--------|--------|----------|-----------|
| PERF-1 | Initial page load | < 2 seconds | ☐ |
| PERF-2 | Auto-save response time | < 500ms | ☐ |
| PERF-3 | Add 20 CDs | No lag | ☐ |
| PERF-4 | Drag animation | Smooth | ☐ |
| PERF-5 | Bundle size | Similar to legacy | ☐ |

---

## Data Integrity Tests

| Test # | Scenario | Expected Result | Pass/Fail |
|--------|----------|----------------|-----------|
| DATA-1 | Save with unified form | Data in student_progress table | ☐ |
| DATA-2 | Load data saved by legacy | Unified form loads it correctly | ☐ |
| DATA-3 | Save with unified, load with legacy | Legacy form loads it correctly | ☐ |
| DATA-4 | Concurrent saves (rapid changes) | No data loss | ☐ |

---

## Edge Cases

| Test # | Scenario | Expected Result | Pass/Fail |
|--------|----------|----------------|-----------|
| EDGE-1 | No internet during auto-save | Graceful error handling | ☐ |
| EDGE-2 | Very long CD text (500+ chars) | Saves and displays correctly | ☐ |
| EDGE-3 | Special characters in CDs | No encoding issues | ☐ |
| EDGE-4 | Add CD via Enter key | Works same as button | ☐ |
| EDGE-5 | Empty CD input, click Add | Nothing happens | ☐ |
| EDGE-6 | Navigate away without saving | Auto-save preserves data | ☐ |

---

## Teacher View Tests

| Test # | Feature | Expected Result | Pass/Fail |
|--------|---------|----------------|-----------|
| TEACH-1 | View student progress | Can see saved CDs | ☐ |
| TEACH-2 | View selected CDs | Selections visible | ☐ |
| TEACH-3 | All 4 writing styles | Works for all | ☐ |

---

## Comparison Test: Legacy vs Unified

### Side-by-Side Test

1. Create 2 identical assignments (same writing style)
2. Complete one with legacy form (flag OFF)
3. Complete one with unified form (flag ON)
4. Compare results:

| Aspect | Legacy | Unified | Match? |
|--------|--------|---------|--------|
| Data saved | ☐ | ☐ | ☐ |
| Auto-save works | ☐ | ☐ | ☐ |
| Validation works | ☐ | ☐ | ☐ |
| Next route correct | ☐ | ☐ | ☐ |
| UI/UX identical | ☐ | ☐ | ☐ |

---

## Bug Tracking

### Found Issues

| Bug # | Writing Style | Description | Severity | Fixed? |
|-------|---------------|-------------|----------|--------|
| | | | | ☐ |
| | | | | ☐ |
| | | | | ☐ |

**Severity Levels:**
- **CRITICAL**: Blocks testing, data loss
- **HIGH**: Major feature broken
- **MEDIUM**: Minor feature issue
- **LOW**: Cosmetic issue

---

## Sign-Off Criteria

Before enabling in production, ALL of these must be ✅:

- [ ] All 4 writing styles tested
- [ ] All regression tests passed
- [ ] No CRITICAL or HIGH severity bugs
- [ ] Performance tests passed
- [ ] Data integrity verified
- [ ] Teacher view verified
- [ ] Feature flag rollback tested
- [ ] Code review approved
- [ ] QA approval received
- [ ] Stakeholder demo completed

---

## Rollback Plan

If issues found during testing:

1. **Immediate rollback:**
   ```bash
   # In .env.local
   USE_UNIFIED_GATHERING_CDS_FORM=false
   ```

2. **Restart server:**
   ```bash
   # Kill current process
   # Restart: npm run dev
   ```

3. **Verify legacy works:**
   - Test all 4 writing styles
   - Confirm students can continue work

4. **Document issues:**
   - Add to "Found Issues" table above
   - Create GitHub issues
   - Fix and re-test

---

## Next Steps After Testing

### If All Tests Pass ✅

1. Deploy to staging with flag OFF
2. Run tests again on staging
3. Enable flag for test users (5-10 students)
4. Monitor for 2-3 days
5. Collect feedback
6. If positive, enable for all users
7. Monitor for 1 week
8. If stable, proceed to cleanup (remove legacy forms)

### If Tests Fail ❌

1. Document all failures
2. Prioritize by severity
3. Fix issues
4. Re-run full test suite
5. Do not deploy until all CRITICAL/HIGH bugs fixed

---

## Test Log

**Tester Name:** ____________________
**Date:** ____________________
**Environment:** ☐ Local ☐ Staging ☐ Production
**Feature Flag Status:** ☐ ON ☐ OFF

**Summary:**
- Total Tests: 100+
- Passed: ____
- Failed: ____
- Skipped: ____

**Overall Status:** ☐ PASS ☐ FAIL ☐ BLOCKED

**Notes:**
_______________________________________
_______________________________________
_______________________________________
