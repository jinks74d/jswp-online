# Phase 2: Shaping Sheets - Analysis & Design

## Current State Analysis

### Forms Count & Lines
- **Argumentation:** `ArgumentationShapingSheetForm.tsx` (725 lines)
- **Expository:** `ExpositoryShapingSheetForm.tsx` (735 lines)
- **Narrative:** 3 forms + 1 unused
  - `NarrativeShapingSheet1Form.tsx` (594 lines)
  - `NarrativeShapingSheet2Form.tsx` (597 lines)
  - `NarrativeShapingSheet3Form.tsx` (597 lines)
  - `NarrativeShapingSheetForm.tsx` (385 lines) - appears unused
- **Literary:** `ShapingSheetForm.tsx` (759 lines)

**Total:** 4,392 lines across 7 files

---

## Key Differences Identified

### 1. **Argumentation** (Single Sheet)
**Fields:**
- Topic Sentence
- Concession/Counterargument/Counterclaim
- Refutation
- Concrete Details (array)
- Commentary Sentence
- Concluding Sentence

**Data Source:** First Draft (step5)
**Next Route:** `/final-draft`
**Save Key:** `shapingSheet`

### 2. **Expository** (Single Sheet)
**Fields:**
- Topic Sentence
- Chunk 1 CD
- Chunk 2 CD (if 2 chunks)
- Commentary Sentence
- Concluding Sentence
- Selected Chunks (1 or 2)

**Data Source:** Commentary Development
**Next Route:** `/final-draft`
**Save Key:** `shapingSheet`

### 3. **Narrative** (3-Sheet Sequence)
**Each Sheet Has:**
- Topic Sentence
- Concrete Details (array)
- Commentary (text)
- Concluding Sentence
- Assembled Paragraph (auto-generated, color-coded HTML)

**Sheet 1:**
- **Data Source:** T-Chart 1 (when/where/who CDs)
- **Next Route:** `/shaping-sheet-2`
- **Save Key:** `shapingSheet1`

**Sheet 2:**
- **Data Source:** T-Chart 2 (what happened CDs)
- **Next Route:** `/shaping-sheet-3`
- **Save Key:** `shapingSheet2`

**Sheet 3:**
- **Data Source:** T-Chart 3 (why/how/impact CDs)
- **Next Route:** `/final-draft`
- **Save Key:** `shapingSheet3`

**Unique Feature:** Auto-assembled color-coded paragraph
- Blue: Topic/Concluding Sentences
- Red: Concrete Details
- Green: Commentary

### 4. **Literary** (Single Sheet)
**Fields:**
- Topic Sentence
- Chunk 1 CD
- Chunk 1 CM 1
- Chunk 1 CM 2
- Chunk 2 CD (if 2 chunks)
- Chunk 2 CM 1
- Chunk 2 CM 2
- Concluding Sentence
- Selected Chunks (1 or 2)

**Data Source:** Step 4 (elaboration), Step 5 (first draft CMs)
**Next Route:** `/final-draft`
**Save Key:** `step6`

---

## Common Patterns

### Shared Logic (All Forms)
1. **Auto-save** with 1-second debounce
2. **Data preservation** from previous steps
3. **Load previous data** on mount
4. **Save to `student_progress.concrete_details`**
5. **Auto-save status** indicator (idle/saving/saved)
6. **Help modal** with tips
7. **Back/Save/Save and Next** buttons
8. **Due date indicator**
9. **Assignment progress display**

### Shared UI Components
- Header with icon, title, help button
- Auto-save status indicator
- Form fields (text areas)
- Action buttons
- Assignment info card
- Tip modal

---

## Configuration Design

### Shaping Sheet Types

```typescript
type ShapingSheetType = 'single' | 'sequence';
type ShapingFieldType = 'text' | 'textarea' | 'cd-array';
```

### Field Configurations

**Argumentation Fields:**
- topicSentence
- concessionCounterargument (special)
- refutation (special)
- concreteDetails (array)
- commentarySentence
- concludingSentence

**Expository Fields:**
- topicSentence
- chunk1CD
- chunk2CD (conditional)
- commentarySentence
- concludingSentence

**Narrative Fields (per sheet):**
- topicSentence
- concreteDetails (array)
- commentary (text block)
- concludingSentence
- assembledParagraph (auto-generated)

**Literary Fields:**
- topicSentence
- chunk1CD
- chunk1CM1
- chunk1CM2
- chunk2CD (conditional)
- chunk2CM1
- chunk2CM2
- concludingSentence

---

## Proposed Architecture

### Option 1: Two Components (Recommended)
**UnifiedSingleSheetForm.tsx** (~800 lines)
- Handles: Argumentation, Expository, Literary
- Config-driven field rendering
- Conditional field display based on writing style

**UnifiedNarrativeShapingSequence.tsx** (~700 lines)
- Handles: Narrative (3 sheets)
- Sheet navigation built-in
- Auto-paragraph assembly
- Color-coded preview

**Why this approach:**
1. Narrative is fundamentally different (sequence vs single)
2. Narrative has unique auto-assembly feature
3. Cleaner separation of concerns
4. Easier to maintain
5. Each component ~700-800 lines (manageable)

### Option 2: One Component (Higher Complexity)
**UnifiedShapingForm.tsx** (~1,500 lines)
- Handles all 4 writing styles
- Nested conditionals for sequence vs single
- Higher complexity, harder to maintain

**Recommendation:** Go with Option 1

---

## Configuration Structure

```typescript
interface WritingStyleShapingConfig {
  style: WritingStyle;
  displayName: string;

  behavior: {
    sheetType: 'single' | 'sequence';
    sequenceCount?: number; // For narrative: 3
    fields: ShapingField[];
    autoAssembleParagraph?: boolean; // For narrative
    cdSource: string; // Where to load CDs from
  };

  ui: {
    pageTitle: string;
    instructions: string;
    helpText: HelpTextSection[];
    buttons: ButtonLabels;
  };

  validation: {
    requiredFields: string[];
    validateSubmit: (data: any) => ValidationResult;
  };

  navigation: {
    backRoute: string;
    nextRoute: string;
  };
}

interface ShapingField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'cd-array';
  placeholder?: string;
  conditional?: {
    field: string; // e.g., 'selectedChunks'
    value: any; // e.g., 2
  };
  readonly?: boolean;
}
```

---

## Data Structure Compatibility

### Current Save Structure
**Argumentation:**
```json
{
  "shapingSheet": {
    "topicSentence": "...",
    "concessionCounterargument": "...",
    "refutation": "...",
    "concreteDetails": ["...", "..."],
    "commentarySentence": "...",
    "concludingSentence": "..."
  }
}
```

**Expository:**
```json
{
  "shapingSheet": {
    "topicSentence": "...",
    "chunk1CD": "...",
    "chunk2CD": "...",
    "commentarySentence": "...",
    "concludingSentence": "...",
    "selectedChunks": 2
  }
}
```

**Narrative:**
```json
{
  "shapingSheet1": { /* ... */ },
  "shapingSheet2": { /* ... */ },
  "shapingSheet3": { /* ... */ }
}
```

**Literary:**
```json
{
  "step6": {
    "topicSentence": "...",
    "chunk1CD": "...",
    "chunk1CM1": "...",
    "chunk1CM2": "...",
    "chunk2CD": "...",
    "chunk2CM1": "...",
    "chunk2CM2": "...",
    "concludingSentence": "...",
    "selectedChunks": 2
  }
}
```

**Decision:** Keep existing save keys for backward compatibility

---

## Implementation Plan

### Step 1: Extend Types
Add `WritingStyleShapingConfig` interface to `types.ts`

### Step 2: Create Configs
- `argumentationShapingConfig`
- `expositoryShapingConfig`
- `narrativeShapingConfig` (with 3 sheet configs)
- `literaryShapingConfig`

### Step 3: Build Components
1. **UnifiedSingleSheetForm.tsx** first (easier)
   - Handles: Argumentation, Expository, Literary
   - ~800 lines

2. **UnifiedNarrativeShapingSequence.tsx** second
   - Handles: Narrative 3-sheet sequence
   - Sheet state management
   - Auto-paragraph assembly
   - ~700 lines

### Step 4: Update Routes
- `/app/dashboard/assignments/[id]/shaping/page.tsx`
- Add feature flags:
  - `USE_UNIFIED_SINGLE_SHAPING_FORM=false`
  - `USE_UNIFIED_NARRATIVE_SHAPING_SEQUENCE=false`

### Step 5: Test
- Build verification
- Manual testing of all 4 styles
- Data preservation verification

---

## Estimated Code Reduction

**Before:**
- 7 forms
- 4,392 lines total

**After:**
- 2 unified components
- UnifiedSingleSheetForm: ~800 lines
- UnifiedNarrativeShapingSequence: ~700 lines
- Configs: ~200 lines
- **Total: ~1,700 lines**

**Savings: 4,392 → 1,700 = 2,692 lines (61% reduction)**

---

## Special Considerations

### Narrative Auto-Assembly
The narrative forms have a unique feature: auto-assembled color-coded paragraphs.

```typescript
const assembleColorCodedParagraph = (data) => {
  const parts = [];
  if (data.topicSentence.trim()) {
    parts.push(`<span style="color: #2563eb;">${data.topicSentence}</span>`);
  }
  data.concreteDetails.forEach(cd => {
    if (cd.trim()) {
      parts.push(`<span style="color: #dc2626;">${cd}</span>`);
    }
  });
  if (data.commentary.trim()) {
    parts.push(`<span style="color: #16a34a;">${data.commentary}</span>`);
  }
  if (data.concludingSentence.trim()) {
    parts.push(`<span style="color: #2563eb;">${data.concludingSentence}</span>`);
  }
  return parts.join(' ');
};
```

This needs to be:
1. Preserved in UnifiedNarrativeShapingSequence
2. Rendered with `SafeHTML` component
3. Auto-updated on field changes

### Chunking Behavior
Expository and Literary have conditional Chunk 2 fields based on `selectedChunks` value. This needs config-driven conditional rendering.

---

## Next Steps

1. ✅ Analysis complete
2. **Design configuration system** ← Next
3. Extend types.ts
4. Create configs
5. Build UnifiedSingleSheetForm
6. Build UnifiedNarrativeShapingSequence
7. Update routes
8. Test build
9. Create documentation

---

## Risk Assessment

**Low Risk:**
- Single sheet forms (Argumentation, Expository, Literary)
- Data structure unchanged
- Feature flag allows instant rollback

**Medium Risk:**
- Narrative 3-sheet sequence
- Sheet navigation state management
- Auto-paragraph assembly logic

**Mitigation:**
- Test narrative sequence thoroughly
- Keep auto-assembly logic isolated
- Add comprehensive error handling
- Document edge cases

---

## Success Criteria

✅ All 4 writing styles work correctly
✅ Data loads from previous steps
✅ Auto-save preserves all data
✅ Validation works per style
✅ Navigation routes correctly
✅ Narrative auto-assembly works
✅ Feature flags enable rollback
✅ TypeScript compiles clean
✅ 60%+ code reduction achieved
