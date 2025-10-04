# Testing Checklist: Unified Shaping Components

**Date Created:** 2025-01-02
**Components:** UnifiedSingleSheetForm, UnifiedNarrativeShapingSequence
**Feature Flags:** USE_UNIFIED_SINGLE_SHAPING_FORM, USE_UNIFIED_NARRATIVE_SHAPING_SEQUENCE

---

## Pre-Testing Setup

### 1. Enable Feature Flags
```bash
# In .env.local, set:
USE_UNIFIED_SINGLE_SHAPING_FORM=true
USE_UNIFIED_NARRATIVE_SHAPING_SEQUENCE=true
```

### 2. Verify Configuration Files
- [ ] `lib/assignment-configs/argumentation.config.ts` exports `argumentationShapingConfig`
- [ ] `lib/assignment-configs/expository.config.ts` exports `expositoryShapingConfig`
- [ ] `lib/assignment-configs/literary.config.ts` exports `literaryShapingConfig`
- [ ] `lib/assignment-configs/narrative.config.ts` exports `narrativeShapingSequenceConfig`
- [ ] `lib/assignment-configs/index.ts` exports getter functions

### 3. Test Data Requirements
- [ ] Create test assignments for each writing style
- [ ] Ensure assignments have completed previous steps (gathering CDs, working TS, etc.)
- [ ] Have test student accounts ready

---

## Component Testing: UnifiedSingleSheetForm

### A. Argumentation Style Testing

#### Data Loading
- [ ] Component loads existing data from `step5` (First Draft)
- [ ] Topic sentence pre-fills correctly
- [ ] Concrete details display correctly from previous step
- [ ] Commentary fields load if previously saved
- [ ] Concession/Counterargument fields load correctly
- [ ] Refutation field loads correctly

#### Form Interaction
- [ ] All text areas accept input
- [ ] Character limits work correctly (if configured)
- [ ] Tab navigation works between fields
- [ ] Concrete details display as read-only list

#### Auto-save Functionality
- [ ] Auto-save triggers after 1 second of inactivity
- [ ] "Saving..." indicator appears during save
- [ ] "Saved" indicator appears after successful save
- [ ] Data persists after page refresh
- [ ] Save key is `shapingSheet`

#### Validation
- [ ] Cannot submit with empty topic sentence
- [ ] Cannot submit with empty concession/counterargument
- [ ] Cannot submit with empty refutation
- [ ] Cannot submit with empty commentary sentence
- [ ] Cannot submit with empty concluding sentence
- [ ] Error messages are clear and specific

#### Navigation
- [ ] Back button goes to `/dashboard/assignments/[id]/first-draft`
- [ ] Submit navigates to `/dashboard/assignments/[id]/final-draft`
- [ ] Browser back/forward maintains form state

#### Help Modal
- [ ] Tips button opens modal
- [ ] Modal displays argumentation-specific tips
- [ ] Modal can be closed with X button
- [ ] Modal can be closed with "Got it" button

---

### B. Expository Style Testing

#### Data Loading
- [ ] Component loads existing data from `commentary` step
- [ ] Topic sentence pre-fills correctly
- [ ] Chunk 1 CD loads correctly
- [ ] Chunk 2 CD loads if selectedChunks === 2
- [ ] Commentary sentence loads correctly
- [ ] Concluding sentence loads correctly

#### Conditional Field Rendering
- [ ] Chunk 2 CD field only appears when selectedChunks === 2
- [ ] Chunk 2 CD field hides when selectedChunks === 1
- [ ] selectedChunks value persists across sessions

#### Form Interaction
- [ ] All visible text areas accept input
- [ ] Hidden fields don't interfere with form
- [ ] Tab navigation skips hidden fields

#### Auto-save Functionality
- [ ] Auto-save works with conditional fields
- [ ] Hidden field values are preserved
- [ ] Save key is `shapingSheet`

#### Validation
- [ ] Chunk 2 validation only applies when selectedChunks === 2
- [ ] Required field validation works correctly
- [ ] Conditional validation messages are clear

#### Navigation
- [ ] Back button goes to `/dashboard/assignments/[id]/working-topic-sentence`
- [ ] Submit navigates to `/dashboard/assignments/[id]/final-draft`

---

### C. Literary Style Testing

#### Data Loading
- [ ] Component loads existing data from `step4` (elaboration)
- [ ] Topic sentence pre-fills correctly
- [ ] Chunk 1 CD and CM fields load correctly
- [ ] Chunk 2 fields load if selectedChunks === 2
- [ ] All commentary fields (CM1, CM2) load correctly

#### Conditional Field Rendering
- [ ] Chunk 2 fields (CD, CM1, CM2) only appear when selectedChunks === 2
- [ ] Total of 3 fields hide/show together for chunk 2
- [ ] Field visibility is consistent

#### Form Interaction
- [ ] Multiple commentary fields per chunk work correctly
- [ ] Tab order is logical (CD → CM1 → CM2)

#### Auto-save Functionality
- [ ] All fields save correctly
- [ ] Save key is `step6` (different from others!)
- [ ] Complex field structure saves properly

#### Validation
- [ ] All visible required fields are validated
- [ ] Chunk 2 validation conditional on selectedChunks

#### Navigation
- [ ] Back button goes to `/dashboard/assignments/[id]/commentary`
- [ ] Submit navigates to `/dashboard/assignments/[id]/final-draft`

---

## Component Testing: UnifiedNarrativeShapingSequence

### D. Narrative Sheet 1 Testing

#### Data Loading
- [ ] Loads CDs from T-Chart: when_cd, where_cd, who_cd
- [ ] Loads corresponding commentary from T-Chart
- [ ] Preserves existing shapingSheet1 data if available
- [ ] Topic sentence loads correctly

#### Color-Coded Assembly
- [ ] Auto-assembles paragraph on any field change
- [ ] Topic sentence displays in blue (#2563eb)
- [ ] Concrete details display in red (#dc2626)
- [ ] Commentary displays in green (#16a34a)
- [ ] Concluding sentence displays in blue (#2563eb)
- [ ] Assembled paragraph updates in real-time

#### Progress Indicator
- [ ] Sheet 1 indicator shows active (blue)
- [ ] Sheets 2-3 show inactive (gray)
- [ ] Progress bar width is correct (1/3)

#### Form Interaction
- [ ] Topic sentence textarea works
- [ ] Commentary textarea works
- [ ] Concluding sentence textarea works
- [ ] CDs display as read-only list

#### Auto-save Functionality
- [ ] Saves to `shapingSheet1` key
- [ ] Status shows as `shaping_sheet_1`
- [ ] Auto-save triggers after 1 second

#### Navigation
- [ ] Back button goes to `/dashboard/assignments/[id]/t-chart`
- [ ] Submit goes to `/dashboard/assignments/[id]/shaping-sheet-2`

---

### E. Narrative Sheet 2 Testing

#### Data Loading
- [ ] Loads CDs from T-Chart: what_cd, dialogue_cd
- [ ] Loads corresponding commentary from T-Chart
- [ ] Preserves existing shapingSheet2 data if available
- [ ] Previous sheet data doesn't interfere

#### Color-Coded Assembly
- [ ] Auto-assembly works same as Sheet 1
- [ ] Colors are consistent across sheets
- [ ] Paragraph preview updates correctly

#### Progress Indicator
- [ ] Sheet 1 shows complete (light blue)
- [ ] Sheet 2 shows active (blue)
- [ ] Sheet 3 shows inactive (gray)
- [ ] Progress bar width is correct (2/3)

#### Auto-save Functionality
- [ ] Saves to `shapingSheet2` key
- [ ] Status shows as `shaping_sheet_2`
- [ ] Doesn't overwrite Sheet 1 data

#### Navigation
- [ ] Back button goes to `/dashboard/assignments/[id]/shaping-sheet-1`
- [ ] Submit goes to `/dashboard/assignments/[id]/shaping-sheet-3`

---

### F. Narrative Sheet 3 Testing

#### Data Loading
- [ ] Loads CDs from T-Chart: why_cd, how_cd, impact_cd
- [ ] Loads corresponding commentary from T-Chart
- [ ] Preserves existing shapingSheet3 data if available

#### Color-Coded Assembly
- [ ] Auto-assembly works consistently
- [ ] Final paragraph preview is complete

#### Progress Indicator
- [ ] Sheets 1-2 show complete (light blue)
- [ ] Sheet 3 shows active (blue)
- [ ] Progress bar width is correct (3/3)

#### Auto-save Functionality
- [ ] Saves to `shapingSheet3` key
- [ ] Status shows as `shaping_sheet_3`
- [ ] All 3 sheets' data preserved

#### Navigation
- [ ] Back button goes to `/dashboard/assignments/[id]/shaping-sheet-2`
- [ ] Submit goes to `/dashboard/assignments/[id]/final-draft`

---

## Integration Testing

### G. Cross-Browser Testing
- [ ] Chrome/Edge - all features work
- [ ] Firefox - all features work
- [ ] Safari - all features work
- [ ] Mobile browsers - responsive layout works

### H. Data Persistence Testing
- [ ] Data saves correctly to database
- [ ] Data structure matches expected format
- [ ] Can switch between legacy and unified forms without data loss
- [ ] Concurrent edits handle gracefully

### I. Feature Flag Testing
- [ ] With flags OFF: Legacy forms render
- [ ] With flags ON: Unified forms render
- [ ] No TypeScript errors in either mode
- [ ] Console has no warnings in either mode

### J. Performance Testing
- [ ] Page loads within 2 seconds
- [ ] Auto-save doesn't cause lag
- [ ] Form remains responsive with large text
- [ ] No memory leaks after extended use

---

## Edge Cases & Error Handling

### K. Error Scenarios
- [ ] Network failure during save shows error message
- [ ] Invalid assignment ID redirects appropriately
- [ ] Non-student users are redirected
- [ ] Missing previous step data handles gracefully

### L. Data Edge Cases
- [ ] Empty concrete details array displays message
- [ ] Very long text in fields displays correctly
- [ ] Special characters in text save correctly
- [ ] HTML in text fields is escaped properly

### M. Navigation Edge Cases
- [ ] Direct URL access to sheet 2/3 loads correctly
- [ ] Refresh maintains current sheet and data
- [ ] Browser back from final draft returns to correct sheet

---

## Accessibility Testing

### N. Keyboard Navigation
- [ ] All interactive elements reachable via Tab
- [ ] Tab order is logical
- [ ] Enter key submits form
- [ ] Escape key closes modal

### O. Screen Reader Support
- [ ] Form labels are properly associated
- [ ] Required fields announced correctly
- [ ] Error messages are announced
- [ ] Help text is accessible

---

## Regression Testing

### P. Legacy Form Compatibility
- [ ] Legacy forms still work with flags OFF
- [ ] Data created by legacy forms loads in unified
- [ ] Data created by unified forms loads in legacy
- [ ] No breaking changes to existing workflows

---

## Sign-off

### Test Results Summary
- [ ] All critical tests pass
- [ ] Non-critical issues documented
- [ ] Performance acceptable
- [ ] Ready for production

### Testing Completed By:
- Name: ________________
- Date: ________________
- Environment: ________________

### Issues Found:
```
1. 
2. 
3. 
```

### Notes:
```
Additional observations or recommendations:
```

---

## Quick Test Commands

```bash
# Run dev server with unified forms
USE_UNIFIED_SINGLE_SHAPING_FORM=true USE_UNIFIED_NARRATIVE_SHAPING_SEQUENCE=true npm run dev

# TypeScript check
npx tsc --noEmit

# Lint check
npm run lint

# Test specific configs
node -e "const config = require('./lib/assignment-configs'); console.log(config.getSingleSheetShapingConfig('argumentation'))"
```