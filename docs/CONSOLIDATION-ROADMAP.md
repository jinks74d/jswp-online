# Assignment Forms Consolidation Roadmap

## Current Status: Phase 1 Complete ✅

**Completed:**
- ✅ Gathering CDs Form unified (4 → 1 component)
- ✅ Configuration system established
- ✅ Feature flag infrastructure in place
- ✅ Testing framework created

---

## Remaining Forms Analysis

### Total Forms to Consolidate: 15 forms → ~5-6 unified components

**Current State:**
- 15 style-specific forms
- ~10,384 lines of code
- High duplication (~85% shared logic)

**Target State:**
- 5-6 unified configurable forms
- ~4,000 lines of code + configs
- **~60% code reduction**

---

## Priority Order (Based on Complexity & Impact)

### Phase 2: Shaping Sheet Forms (HIGH PRIORITY)
**Impact: Highest code reduction**

**Current State:**
```
ArgumentationShapingSheetForm.tsx      (~735 lines)
ExpositoryShapingSheetForm.tsx         (~735 lines)
ShapingSheetForm.tsx (literary)        (~759 lines)
NarrativeShapingSheetForm.tsx          (~600 lines)
NarrativeShapingSheet1Form.tsx         (~500 lines)
NarrativeShapingSheet2Form.tsx         (~500 lines)
NarrativeShapingSheet3Form.tsx         (~500 lines)
```
**Total:** ~4,329 lines

**Complexity:**
- Narrative has 3 sequential shaping sheets (unique pattern)
- Other styles have 1 shaping sheet
- Different field structures per style
- **Key difference:** Argumentation has concession/refutation fields

**Unified Approach:**
1. **UnifiedShapingSheetForm.tsx** - Base shaping sheet
2. **NarrativeShapingSequence.tsx** - Handles 3-sheet progression
3. Config defines:
   - Fields per style (topic sentence, CDs, commentary, etc.)
   - Whether it's multi-step (narrative) or single-step
   - Validation rules per style

**Estimated Savings:** 4,329 → 1,500 lines (~65% reduction)

---

### Phase 3: Working Topic Sentence Forms (MEDIUM PRIORITY)
**Impact: Medium code reduction**

**Current State:**
```
ArgumentationWorkingTSForm.tsx        (~836 lines)
ExpositoryWorkingTopicSentenceForm.tsx (~700 lines)
```
**Total:** ~1,536 lines

**Complexity:** Low - Very similar logic, just different prompts/guidance

**Unified Approach:**
- **UnifiedWorkingTopicSentenceForm.tsx**
- Config defines:
   - Prompt/instruction text per style
   - Helper text differences
   - Validation requirements

**Estimated Savings:** 1,536 → 700 lines (~54% reduction)

---

### Phase 4: First Draft Forms (MEDIUM PRIORITY)
**Impact: Medium-High code reduction**

**Current State:**
```
ArgumentationFirstDraftForm.tsx       (~730 lines)
FirstDraftForm.tsx (literary)         (~1,204 lines)
```
**Total:** ~1,934 lines

**Complexity:** Medium - Literary form is significantly larger, may have additional features

**Unified Approach:**
- **UnifiedFirstDraftForm.tsx**
- Config defines:
   - Draft structure requirements
   - Formatting rules per style
   - Submission requirements

**Estimated Savings:** 1,934 → 900 lines (~53% reduction)

---

### Phase 5: Final Draft Forms (LOW PRIORITY)
**Impact: Medium code reduction**

**Current State:**
```
ArgumentationFinalDraftForm.tsx       (~813 lines)
ExpositoryFinalDraftForm.tsx          (~700 lines)
```
**Total:** ~1,513 lines

**Complexity:** Low-Medium - Similar to first draft but with revision features

**Unified Approach:**
- **UnifiedFinalDraftForm.tsx**
- Config defines:
   - Revision requirements
   - Feedback integration
   - Submission finalization

**Estimated Savings:** 1,513 → 700 lines (~54% reduction)

---

### Phase 6: Commentary Forms (LOW PRIORITY)
**Impact: Low code reduction (only 2 forms)**

**Current State:**
```
CommentaryGenerationForm.tsx          (~800 lines)
ExpositoryCommentaryDevelopmentForm.tsx (~700 lines)
```
**Total:** ~1,500 lines

**Complexity:** Low - Very similar, just different guidance

**Unified Approach:**
- **UnifiedCommentaryForm.tsx**
- Config defines:
   - Commentary style guidance
   - Example differences
   - Validation criteria

**Estimated Savings:** 1,500 → 700 lines (~53% reduction)

---

## Implementation Strategy

### Recommended Order:

1. **Phase 2: Shaping Sheets** (Start Here)
   - Highest impact
   - Tests multi-step pattern (narrative 3-sheet sequence)
   - Validates config system with complex variations

2. **Phase 3: Working Topic Sentence**
   - Quick win, low complexity
   - Builds confidence
   - Only 2 forms to consolidate

3. **Phase 4: First Draft**
   - Moderate complexity
   - Important workflow step
   - Literary form needs special attention

4. **Phase 5: Final Draft**
   - Similar to First Draft
   - Can reuse patterns learned

5. **Phase 6: Commentary**
   - Last, least impact
   - Only affects 2 styles

---

## Per-Phase Effort Estimate

### Phase 2: Shaping Sheets (COMPLEX)
**Estimated Time:** 3-4 days
- Day 1: Create shaping sheet configs (all 4 styles)
- Day 2: Build UnifiedShapingSheetForm
- Day 3: Build NarrativeShapingSequence wrapper
- Day 4: Testing all styles, especially narrative 3-step

**Risk:** HIGH (narrative multi-step is unique)
**Reward:** HIGH (4,329 → 1,500 lines)

---

### Phase 3: Working Topic Sentence (SIMPLE)
**Estimated Time:** 1-2 days
- Day 1: Config + Unified component
- Day 2: Testing

**Risk:** LOW (very similar forms)
**Reward:** MEDIUM (1,536 → 700 lines)

---

### Phase 4: First Draft (MODERATE)
**Estimated Time:** 2-3 days
- Day 1: Config analysis (why is literary so much bigger?)
- Day 2: Build unified component
- Day 3: Testing

**Risk:** MEDIUM (literary form complexity unknown)
**Reward:** MEDIUM-HIGH (1,934 → 900 lines)

---

### Phase 5: Final Draft (MODERATE)
**Estimated Time:** 2-3 days
- Similar to First Draft
- Can reuse config patterns

**Risk:** MEDIUM
**Reward:** MEDIUM (1,513 → 700 lines)

---

### Phase 6: Commentary (SIMPLE)
**Estimated Time:** 1-2 days
- Quick consolidation
- Only 2 forms

**Risk:** LOW
**Reward:** LOW (1,500 → 700 lines)

---

## Total Timeline

**Conservative Estimate:** 10-15 days
**Aggressive Estimate:** 7-10 days (if no blockers)

**Recommended:** Do one phase at a time, test thoroughly, then proceed

---

## Configuration System Expansion

For each phase, we'll add to `lib/assignment-configs/`:

```
lib/assignment-configs/
├── types.ts (expand with new interfaces)
├── argumentation.config.ts (add shaping, draft configs)
├── expository.config.ts (add shaping, draft configs)
├── narrative.config.ts (add shaping sequence configs)
├── literary.config.ts (add first draft configs)
└── index.ts (add getters for new configs)
```

---

## Feature Flag Strategy

**Per Phase:**
```bash
# .env.local
USE_UNIFIED_GATHERING_CDS_FORM=false
USE_UNIFIED_SHAPING_SHEET_FORM=false
USE_UNIFIED_WORKING_TS_FORM=false
USE_UNIFIED_FIRST_DRAFT_FORM=false
USE_UNIFIED_FINAL_DRAFT_FORM=false
USE_UNIFIED_COMMENTARY_FORM=false
```

**Benefit:** Can enable/disable each consolidation independently

---

## Success Metrics

### After All Phases Complete:

**Code Reduction:**
- Before: ~10,384 lines (15 forms)
- After: ~4,000 lines (5-6 forms) + ~1,500 lines configs
- **Net Reduction:** ~47% less code

**Maintenance Burden:**
- Before: Fix bug in 4 places
- After: Fix bug in 1 place

**New Feature Velocity:**
- Before: Add feature to 4 forms (4-8 hours)
- After: Add feature to 1 form + config (1-2 hours)

**New Writing Style:**
- Before: Copy-paste entire form, modify (~4-6 hours)
- After: Add config file (~30 minutes)

---

## Risks & Mitigation

### Risk 1: Narrative 3-Sheet Sequence
**Concern:** Unique multi-step pattern may not fit unified model
**Mitigation:**
- Create wrapper component `NarrativeShapingSequence.tsx`
- Each sheet still uses base `UnifiedShapingSheetForm`
- Config defines progression logic

### Risk 2: Literary First Draft Complexity
**Concern:** 1,204 lines vs ~730 for argumentation
**Mitigation:**
- Analyze why it's larger before unifying
- May need style-specific override sections
- Acceptable to have 10-15% style-specific code

### Risk 3: Student Disruption
**Concern:** Mid-semester changes break workflows
**Mitigation:**
- Feature flags = instant rollback
- Test thoroughly before enabling
- Deploy during low-traffic periods
- Phased rollout per form type

---

## Recommendation

**Start with Phase 2: Shaping Sheets**

Why?
1. Highest impact (~4,300 lines → ~1,500)
2. Tests most complex scenario (narrative 3-step)
3. Validates config system under stress
4. Success here proves remaining phases are viable

**Alternative (Conservative):**
Start with Phase 3: Working Topic Sentence
- Lower risk
- Faster success
- Builds team confidence
- Only 2 forms, very similar

---

## Next Steps

1. **Choose starting phase** (recommend Phase 2 or Phase 3)
2. **I'll build the unified component + configs**
3. **Add feature flag**
4. **Create testing checklist**
5. **You test locally**
6. **Repeat for next phase**

Which phase would you like to start with?
- **Option A:** Phase 2 (Shaping Sheets) - High impact, higher risk
- **Option B:** Phase 3 (Working Topic Sentence) - Quick win, low risk
