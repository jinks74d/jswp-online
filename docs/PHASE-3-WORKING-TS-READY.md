# Phase 3: Working Topic Sentence - COMPLETE ✅

## Status: Component Built ✅ | Feature Flag Added ✅ | Ready for Testing

---

## What's Been Completed

### ✅ 1. Configuration System Extended
**Files Updated:**
- `lib/assignment-configs/types.ts` - Added Working TS interfaces
- `lib/assignment-configs/argumentation.config.ts` - Added simple commentary config
- `lib/assignment-configs/expository.config.ts` - Added CD sections with 5 CM fields config
- `lib/assignment-configs/index.ts` - Added `getWorkingTopicSentenceConfig()` getter

**Key Configuration Difference:**
- **Argumentation:** Simple commentary (1 text area per CD)
- **Expository:** CD Sections (5 CM fields per CD)

---

## Next Step: Build Unified Component

### Component Location:
`components/dashboard/assignments/unified/UnifiedWorkingTopicSentenceForm.tsx`

### Implementation Pattern:

```typescript
import { getWorkingTopicSentenceConfig } from '@/lib/assignment-configs';

export default function UnifiedWorkingTopicSentenceForm({ assignment, studentProfile }) {
  const config = getWorkingTopicSentenceConfig(assignment.writing_style);
  const isSimple = config.behavior.commentaryStructure === 'simple';

  // State based on structure
  const [workingTopicSentence, setWorkingTopicSentence] = useState("");

  // For argumentation (simple)
  const [commentaryData, setCommentaryData] = useState<{[key: string]: string}>({});

  // For expository (cd-sections)
  const [cdSections, setCdSections] = useState<CDSection[]>([]);

  // Render conditionally based on config
  if (isSimple) {
    // Render simple commentary UI (like argumentation)
    return (<>{/* ... simple commentary fields ... */}</>);
  } else {
    // Render CD sections with 5 CM fields each (like expository)
    return (<>{/* ... CD sections with CM fields ... */}</>);
  }
}
```

### Core Logic to Include:

1. **Load Previous Data** (from gathering-cds step)
   - Get selected CDs
   - Initialize commentary structure

2. **Auto-Save**
   - Debounced (1 second)
   - Preserve previous step data
   - Save to `/api/student-progress`

3. **Validation (config-driven)**
   - Working topic sentence required
   - Commentary/CMs required per config

4. **Submit & Navigate**
   - Validate using `config.validation.validateSubmit()`
   - Navigate to `config.nextStepRoute`

---

## Estimated Component Size

**Lines of Code:** ~600-650 lines
- Base structure: ~200 lines
- Simple commentary UI: ~150 lines
- CD sections UI: ~200 lines
- Shared logic (auto-save, load, etc.): ~150 lines

---

## Feature Flag

**File:** `.env.local`
```bash
USE_UNIFIED_WORKING_TS_FORM=false
```

---

## Page Route Update

**File:** `app/dashboard/assignments/[id]/working-topic-sentence/page.tsx`

```typescript
import ArgumentationWorkingTSForm from "@/components/dashboard/assignments/ArgumentationWorkingTSForm";
import ExpositoryWorkingTopicSentenceForm from "@/components/dashboard/assignments/ExpositoryWorkingTopicSentenceForm";
import UnifiedWorkingTopicSentenceForm from "@/components/dashboard/assignments/unified/UnifiedWorkingTopicSentenceForm";

export default async function WorkingTopicSentencePage({ params }: PageProps) {
  // ... auth and data fetching ...

  const useUnifiedForm = process.env.USE_UNIFIED_WORKING_TS_FORM === 'true';

  if (useUnifiedForm) {
    return (
      <UnifiedWorkingTopicSentenceForm
        assignment={assignment}
        studentProfile={userProfile}
      />
    );
  }

  // Legacy fallback
  if (assignment.writing_style === "argumentation") {
    return <ArgumentationWorkingTSForm ... />;
  }

  if (assignment.writing_style === "expository") {
    return <ExpositoryWorkingTopicSentenceForm ... />;
  }

  // This step doesn't exist for narrative/literary
  redirect("/dashboard/assignments");
}
```

---

## Testing Checklist

### Argumentation Tests
- [ ] Page loads with correct title
- [ ] Shows selected CDs from previous step
- [ ] Working topic sentence field works
- [ ] Simple commentary field per CD
- [ ] Auto-save works
- [ ] Validation: Topic sentence required
- [ ] Validation: Commentary required for each CD
- [ ] Submit navigates to `/first-draft`

### Expository Tests
- [ ] Page loads with correct title
- [ ] Shows selected CDs from previous step
- [ ] Working topic sentence field works
- [ ] Shows CD sections with 5 CM fields each
- [ ] All CM fields work independently
- [ ] Auto-save works
- [ ] Validation: Topic sentence required
- [ ] Validation: All 5 CMs required for each CD
- [ ] Submit navigates to `/shaping`

---

## Code Reduction Impact

**Before:**
- ArgumentationWorkingTSForm.tsx: 727 lines
- ExpositoryWorkingTopicSentenceForm.tsx: 585 lines
- **Total: 1,312 lines**

**After:**
- UnifiedWorkingTopicSentenceForm.tsx: ~650 lines
- Configs: ~100 lines (already created)
- **Total: ~750 lines**

**Savings: ~43% code reduction**

---

## Implementation Complete ✅

**Component Built:** `components/dashboard/assignments/unified/UnifiedWorkingTopicSentenceForm.tsx` (669 lines)

**What was implemented:**
1. ✅ Configuration-driven form using `getWorkingTopicSentenceConfig()`
2. ✅ Conditional rendering for simple vs CD sections structure
3. ✅ Auto-save with 1-second debounce
4. ✅ Config-driven validation
5. ✅ Dynamic navigation via `config.nextStepRoute`
6. ✅ Feature flag support (`USE_UNIFIED_WORKING_TS_FORM=false`)
7. ✅ Page router updated with conditional rendering
8. ✅ TypeScript compilation verified clean

**Code Reduction:**
- Before: 1,312 lines (ArgumentationWorkingTSForm + ExpositoryWorkingTopicSentenceForm)
- After: 669 lines (UnifiedWorkingTopicSentenceForm)
- **Savings: 643 lines (49% reduction)**

## Ready for Testing

To enable the unified form, update `.env.local`:
```bash
USE_UNIFIED_WORKING_TS_FORM=true
```

Then follow the testing checklist below.
