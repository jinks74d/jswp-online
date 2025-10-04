# Testing Checklist: Unified Working Topic Sentence Form

## Setup

1. **Enable Feature Flag**
   ```bash
   # In .env.local
   USE_UNIFIED_WORKING_TS_FORM=true
   ```

2. **Restart Dev Server**
   ```bash
   npm run dev
   ```

---

## Test Data Setup

### Argumentation Assignment
- **Writing Style:** Argumentation
- **Previous Step:** Should have completed T-Chart (decisions)
- **Expected Data:** Selected CDs from Gathering CDs step

### Expository Assignment
- **Writing Style:** Expository
- **Previous Step:** Should have completed Gathering CDs
- **Expected Data:** Selected CDs with 2-4 CDs per chunk

---

## Argumentation Tests (Simple Commentary Structure)

### ✅ Page Load & Navigation
- [ ] Navigate to `/dashboard/assignments/{id}/working-topic-sentence` for argumentation assignment
- [ ] Page loads without errors
- [ ] Displays correct page title: "WORKING TOPIC SENTENCE"
- [ ] Shows argumentation icon (argumentation01-circle-cmyk.jpg)
- [ ] "Back to Topic Sentence Development" link works correctly
- [ ] Due date indicator displays correctly

### ✅ Data Loading
- [ ] Working topic sentence field auto-populates from T-Chart data (if exists)
- [ ] Selected CDs from Gathering CDs step display correctly
- [ ] Commentary data loads if returning to this step
- [ ] All previous step data preserved

### ✅ Working Topic Sentence Input
- [ ] Text area is visible and editable
- [ ] Placeholder text displays: "Enter your working topic sentence..."
- [ ] Character/word count updates as user types
- [ ] Input styling matches design (green border)

### ✅ Simple Commentary Section
- [ ] Section header displays: "COMMENTARY DEVELOPMENT"
- [ ] Each selected CD displays in its own card
- [ ] CD number displays correctly (CONCRETE DETAIL #1, #2, etc.)
- [ ] CD text displays in red/uppercase
- [ ] 5 commentary input fields per CD (2-1-2 layout)
- [ ] All input fields are editable
- [ ] Commentary fields have green borders

### ✅ Auto-Save
- [ ] Auto-save indicator appears after 1 second of inactivity
- [ ] "Saving..." status shows during save
- [ ] "Saved" checkmark appears on success
- [ ] Status indicator disappears after 2 seconds
- [ ] Data persists on page reload

### ✅ Validation
- [ ] Cannot proceed without working topic sentence
- [ ] Alert shows if topic sentence is empty: "Please enter a working topic sentence"
- [ ] Cannot proceed if any commentary field is empty
- [ ] Alert shows: "Please provide commentary for all concrete details"

### ✅ Save & Navigation
- [ ] "Back" button navigates to `/dashboard/assignments/{id}/decisions`
- [ ] "Save" button saves data and shows success alert
- [ ] "Save and Next" button validates, saves, and navigates to `/dashboard/assignments/{id}/first-draft`
- [ ] All buttons disable during save operation
- [ ] All previous step data preserved after save

### ✅ UI Elements
- [ ] Help modal opens when clicking help icon
- [ ] Help modal displays correct tips from config
- [ ] Help modal closes with X button or "Got it!" button
- [ ] Assignment progress section displays correctly
- [ ] Progress shows 50% for this step
- [ ] Days remaining displays correctly

---

## Expository Tests (CD Sections Structure)

### ✅ Page Load & Navigation
- [ ] Navigate to `/dashboard/assignments/{id}/working-topic-sentence` for expository assignment
- [ ] Page loads without errors
- [ ] Displays correct page title: "WORKING TOPIC SENTENCE"
- [ ] Shows expository icon (expository01-circle-cmyk.jpg)
- [ ] "Back to Gathering CDs" link works correctly
- [ ] Print button displays (functional or not)
- [ ] Due date indicator displays correctly

### ✅ Data Loading
- [ ] Selected CDs from Gathering CDs step load correctly
- [ ] Creates CD sections for each selected CD
- [ ] Each section has 5 empty CM fields initially
- [ ] Working topic sentence loads if returning to this step
- [ ] All CM data loads if returning to this step
- [ ] Selected chunks count loads correctly

### ✅ Working Topic Sentence Input
- [ ] Text area is visible and editable
- [ ] Placeholder displays: "Enter your working topic sentence here..."
- [ ] Input styling matches design (blue border)
- [ ] No character/word count (expository specific)

### ✅ CD Sections
- [ ] Each selected CD displays in its own section
- [ ] CD header shows: "CONCRETE DETAIL #N: {CD text}"
- [ ] CD header has red background with white text
- [ ] Each section has exactly 5 CM fields
- [ ] CM fields arranged in 2-1-2 layout (top row: 2, middle: 1 oval, bottom row: 2)
- [ ] Middle CM field has oval/rounded styling
- [ ] All CM fields are text areas (not inputs)
- [ ] All CM fields are editable
- [ ] CM fields have green borders
- [ ] Section header displays: "CMs / This CD was important because...Why?"

### ✅ Auto-Save
- [ ] Auto-save indicator appears after 1 second of inactivity
- [ ] "Saving..." status shows during save
- [ ] "Saved" checkmark appears on success
- [ ] Status indicator disappears after 2 seconds
- [ ] Data persists on page reload
- [ ] All CD sections and CM data preserved

### ✅ Validation
- [ ] Cannot proceed without working topic sentence
- [ ] Alert shows if topic sentence is empty: "Please enter a working topic sentence"
- [ ] Cannot proceed if any CM is empty
- [ ] Alert shows: "Please provide all 5 commentary statements (CMs) for each concrete detail"
- [ ] Validation checks all CD sections

### ✅ Save & Navigation
- [ ] "Back" button navigates to `/dashboard/assignments/{id}/gathering-cds`
- [ ] "Save" button saves data and shows success alert
- [ ] "Save and Next" button validates, saves, and navigates to `/dashboard/assignments/{id}/shaping`
- [ ] All buttons disable during save operation
- [ ] All previous step data preserved after save

### ✅ UI Elements
- [ ] Help modal opens when clicking help icon
- [ ] Help modal displays correct tips from config
- [ ] Help modal shows 3 sections for expository
- [ ] Help modal closes with X button or "Got it!" button
- [ ] Assignment progress section displays correctly
- [ ] Progress shows 75% for expository (not 50%)
- [ ] Days remaining displays correctly

---

## Cross-Browser Tests

### Desktop Browsers
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)

### Mobile Browsers
- [ ] iOS Safari
- [ ] Chrome Mobile
- [ ] Samsung Internet

---

## Accessibility Tests

### Keyboard Navigation
- [ ] Can tab through all form fields
- [ ] Can focus on all interactive elements
- [ ] Enter/Space triggers buttons
- [ ] Escape closes modal
- [ ] Tab order is logical

### Screen Reader
- [ ] Form labels are announced correctly
- [ ] Input fields have proper ARIA labels
- [ ] Button purposes are clear
- [ ] Error messages are announced

---

## Error Handling Tests

### Network Errors
- [ ] Graceful handling when auto-save fails
- [ ] Error message displays if save fails
- [ ] Can retry after network error
- [ ] No data loss on temporary network issues

### Invalid Data
- [ ] Handles missing previous step data
- [ ] Shows appropriate message if CDs not found
- [ ] Doesn't crash with corrupted data
- [ ] Falls back gracefully to empty state

---

## Performance Tests

- [ ] Page loads in under 2 seconds
- [ ] Auto-save doesn't cause UI lag
- [ ] Form remains responsive with many CDs
- [ ] No memory leaks during extended use
- [ ] Typing in fields is smooth (no debounce lag)

---

## Feature Flag Tests

### Flag Disabled (Legacy Mode)
```bash
USE_UNIFIED_WORKING_TS_FORM=false
```

- [ ] Argumentation uses `ArgumentationWorkingTSForm`
- [ ] Expository uses `ExpositoryWorkingTopicSentenceForm`
- [ ] Both legacy forms work correctly
- [ ] Data structure remains compatible

### Flag Enabled (Unified Mode)
```bash
USE_UNIFIED_WORKING_TS_FORM=true
```

- [ ] Argumentation uses `UnifiedWorkingTopicSentenceForm`
- [ ] Expository uses `UnifiedWorkingTopicSentenceForm`
- [ ] Both writing styles work correctly
- [ ] Data structure remains compatible with legacy

---

## Data Integrity Tests

### Backward Compatibility
- [ ] Can load data saved by legacy forms
- [ ] Can continue assignment started with legacy forms
- [ ] No data loss when switching between forms

### Forward Compatibility
- [ ] Data saved by unified form works with legacy forms
- [ ] Can switch flag off and continue assignment
- [ ] All fields accessible in both modes

### Data Preservation
- [ ] Saving preserves all previous step data
- [ ] Chunk 1 and Chunk 2 CDs remain intact
- [ ] Selected CD indexes preserved
- [ ] T-Chart data (argumentation) not overwritten
- [ ] Selected chunks count (expository) preserved

---

## Configuration Tests

### Argumentation Config
- [ ] `commentaryStructure` is 'simple'
- [ ] Uses `simpleCommentary` label and placeholder
- [ ] Next route is `/first-draft`
- [ ] Validation checks commentary data
- [ ] Help text matches argumentation config

### Expository Config
- [ ] `commentaryStructure` is 'cd-sections'
- [ ] Uses `cdSections` with 5 CM fields
- [ ] Next route is `/shaping`
- [ ] Validation checks all 5 CMs per CD
- [ ] Help text matches expository config

---

## Edge Cases

### Chunk Scenarios
- [ ] Works with 1 chunk (Chunk 1 only)
- [ ] Works with 2 chunks (Chunk 1 + Chunk 2)
- [ ] Handles varying numbers of selected CDs (2-4 per chunk)

### Data Scenarios
- [ ] Empty state (no previous data)
- [ ] Partial data (some fields filled)
- [ ] Complete data (all fields filled)
- [ ] Returning to edit after completion

### User Scenarios
- [ ] New assignment start
- [ ] Continuing saved progress
- [ ] Editing after submission
- [ ] Multiple students on same assignment

---

## Regression Tests

### Existing Features
- [ ] Authentication still works
- [ ] Role-based access unchanged
- [ ] Assignment list page unaffected
- [ ] Other assignment steps unaffected
- [ ] Teacher view unaffected

### Database
- [ ] student_progress table structure unchanged
- [ ] concrete_details JSON structure compatible
- [ ] No migration required
- [ ] Queries still efficient

---

## Sign-Off

### Developer Testing
- [ ] All unit tests pass (if applicable)
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Code reviewed and approved

### QA Testing
- [ ] All test cases executed
- [ ] Critical bugs fixed
- [ ] No blockers remaining
- [ ] Ready for production

### Product Owner
- [ ] Meets acceptance criteria
- [ ] UX matches design
- [ ] Performance acceptable
- [ ] Approved for release

---

## Rollback Plan

If issues are found in production:

1. **Immediate Rollback**
   ```bash
   # Set in production .env
   USE_UNIFIED_WORKING_TS_FORM=false
   ```

2. **Verify Legacy Forms**
   - Test both argumentation and expository
   - Confirm data integrity
   - Check all functionality

3. **Debug and Fix**
   - Reproduce issue in development
   - Fix and re-test
   - Deploy fix with flag enabled

---

## Notes

- **Estimated Testing Time:** 3-4 hours for complete checklist
- **Priority Tests:** Data loading, validation, save/navigation
- **High Risk Areas:** Auto-save, data preservation, validation
- **Browser Support:** Modern browsers (last 2 versions)
