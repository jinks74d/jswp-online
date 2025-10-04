# Proof of Concept: Unified Gathering CDs Form

## Status: Ready for Implementation

This document describes the proof of concept for consolidating 4 writing-style-specific Gathering CDs forms into 1 unified, configurable component.

---

## What's Been Created

### 1. Configuration System ✅

**Location:** `lib/assignment-configs/`

**Files Created:**
- `types.ts` - TypeScript definitions for all configs
- `argumentation.config.ts` - Argumentation-specific behavior
- `expository.config.ts` - Expository-specific behavior
- `narrative.config.ts` - Narrative-specific behavior
- `literary.config.ts` - Literary-specific behavior (single-select mode)
- `index.ts` - Central export with `getGatheringCDsConfig()` helper

**Key Features:**
- Defines behavior differences (single vs multi-select)
- UI text customization per style
- Validation rules per style
- Next step routing per style

---

## How It Works

### Before (4 Separate Components)
```
components/dashboard/assignments/
├── ArgumentationGatheringCdsForm.tsx (692 lines)
├── ExpositoryGatheringCdsForm.tsx (~700 lines)
├── NarrativeGatheringCdsForm.tsx (~700 lines)
└── GatheringCdsForm.tsx (literary, ~700 lines)
```

**Total:** ~2,800 lines with 80% duplication

### After (1 Unified Component)
```
components/dashboard/assignments/unified/
└── UnifiedGatheringCDsForm.tsx (~750 lines)
```

**Total:** ~750 lines + 400 lines of config = 1,150 lines
**Savings:** 60% code reduction

---

## Next Steps for Implementation

### Step 1: Build the Unified Component

Create `components/dashboard/assignments/unified/UnifiedGatheringCDsForm.tsx` with:

```typescript
import { getGatheringCDsConfig } from '@/lib/assignment-configs';

interface UnifiedGatheringCDsFormProps {
  assignment: Assignment;
  studentProfile: StudentProfile;
}

export default function UnifiedGatheringCDsForm({
  assignment,
  studentProfile,
}: UnifiedGatheringCDsFormProps) {
  // Load config based on writing style
  const config = getGatheringCDsConfig(assignment.writing_style);

  // All the shared logic (692 lines from ArgumentationGatheringCdsForm)
  // State management
  // Auto-save
  // Drag-and-drop
  // Validation

  // Conditional rendering based on config.behavior.selectionMode
  if (config.behavior.selectionMode === 'multi') {
    // Argumentation/Expository/Narrative: multi-select checkboxes
  } else {
    // Literary: single-select radio buttons
  }

  // Use config.ui.* for all text
  // Use config.validation.* for all validations
}
```

**Key Implementation Details:**

1. **Selection Mode Logic:**
   ```typescript
   const selectCD = (chunkNumber: 1 | 2, index: number) => {
     if (config.behavior.selectionMode === 'single') {
       // Replace selection (literary)
       setSelected([index]);
     } else {
       // Toggle selection (arg/exp/narr)
       setSelected(prev =>
         prev.includes(index)
           ? prev.filter(i => i !== index)
           : [...prev, index]
       );
     }
   };
   ```

2. **Validation:**
   ```typescript
   const handleSubmit = async () => {
     const validation = config.validation.validateSubmit({
       chunk1CDs,
       chunk2CDs,
       selectedChunk1CDs,
       selectedChunk2CDs,
       selectedChunks,
     });

     if (!validation.valid) {
       alert(validation.message);
       return;
     }

     // Save and navigate to config.nextStepRoute
   };
   ```

3. **UI Text:**
   ```typescript
   <h2>{config.ui.pageTitle}</h2>
   <p>{config.ui.instructionText}</p>
   <input placeholder={config.ui.cdPlaceholder} />
   <button>{config.ui.buttons.addCD}</button>
   ```

---

### Step 2: Add Feature Flag to .env.local

```bash
# Feature flag for unified forms
USE_UNIFIED_GATHERING_CDS_FORM=false
```

---

### Step 3: Update Page Route with Feature Flag

**File:** `app/dashboard/assignments/[id]/gathering-cds/page.tsx`

```typescript
import GatheringCdsForm from "@/components/dashboard/assignments/GatheringCdsForm";
import ExpositoryGatheringCdsForm from "@/components/dashboard/assignments/ExpositoryGatheringCdsForm";
import ArgumentationGatheringCdsForm from "@/components/dashboard/assignments/ArgumentationGatheringCdsForm";
import NarrativeGatheringCdsForm from "@/components/dashboard/assignments/NarrativeGatheringCdsForm";
import UnifiedGatheringCDsForm from "@/components/dashboard/assignments/unified/UnifiedGatheringCDsForm";

export default async function GatheringCdsPage({ params }: PageProps) {
  // ... existing auth and data fetching ...

  const useUnifiedForm = process.env.USE_UNIFIED_GATHERING_CDS_FORM === 'true';

  if (useUnifiedForm) {
    // NEW: Single unified component
    return (
      <UnifiedGatheringCDsForm
        assignment={assignment}
        studentProfile={userProfile}
      />
    );
  }

  // LEGACY: Style-specific components (fallback)
  if (assignment.writing_style === "expository") {
    return <ExpositoryGatheringCdsForm ... />
  }
  // ... other styles ...
}
```

---

## Testing Plan

### Test Matrix (16 test cases)

| Writing Style  | Test Case | Expected Behavior |
|---------------|-----------|-------------------|
| Argumentation | Add CDs | Allows adding multiple CDs |
| Argumentation | Select CDs | Multi-select (2-4) |
| Argumentation | Validation | Requires 2-4 selections |
| Argumentation | Next step | Routes to `/shaping` |
| Expository | Add CDs | Allows adding multiple CDs |
| Expository | Select CDs | Multi-select (2-4) |
| Expository | Validation | Requires 2-4 selections |
| Expository | Next step | Routes to `/working-topic-sentence` |
| Narrative | Add CDs | Allows adding multiple CDs |
| Narrative | Select CDs | Multi-select (2-4) |
| Narrative | Validation | Requires 2-4 selections |
| Narrative | Next step | Routes to `/shaping-1` |
| Literary | Add CDs | Allows adding multiple CDs |
| Literary | Select CDs | **Single-select (1 only)** |
| Literary | Validation | Requires 1 selection |
| Literary | Next step | Routes to `/commentary` |

### Regression Tests

1. **Auto-save:** Works for all styles
2. **Drag-and-drop:** Works for all styles
3. **Load previous data:** Works for all styles
4. **Teacher can view:** Student progress visible
5. **Chunk 2:** Shows when `selectedChunks === 2`

---

## Rollback Strategy

### Instant Rollback
```bash
# In .env.local
USE_UNIFIED_GATHERING_CDS_FORM=false
```

### Code Rollback
1. Keep legacy forms in `components/dashboard/assignments/`
2. Revert page.tsx import
3. Delete unified component

**No database changes required** - both forms use same data structure.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Literary single-select breaks | HIGH | Extensive testing, feature flag |
| Auto-save data mismatch | MEDIUM | Same API, same data structure |
| Performance regression | LOW | Same logic, slightly more conditionals |
| Student disruption | HIGH | Deploy off-hours, phased rollout |

---

## Success Criteria

✅ All 16 test cases pass
✅ Feature parity with legacy forms
✅ No student-reported issues after 1 week
✅ Code review approval from 2+ developers

---

## Estimated Timeline

- **Day 1:** Build `UnifiedGatheringCDsForm.tsx` (6-8 hours)
- **Day 2:** Testing all 4 styles (4 hours)
- **Day 3:** Code review and fixes (3 hours)
- **Day 4:** Deploy to staging with flag OFF (1 hour)
- **Day 5:** QA testing on staging (4 hours)
- **Day 6:** Enable flag for test users (2 hours)
- **Day 7:** Monitor, collect feedback (2 hours)
- **Week 2:** Enable in production if successful

**Total:** ~7-10 days for complete POC rollout

---

## Recommendation

**Proceed with implementation** if:
1. You have dedicated QA time available
2. You can deploy to staging first
3. You have a rollback window during low usage

**Wait** if:
1. Mid-semester with active students
2. No staging environment
3. Limited QA resources

**Alternative:** Start with read-only mode where unified component renders but saves via legacy API, allowing visual testing without risk.
