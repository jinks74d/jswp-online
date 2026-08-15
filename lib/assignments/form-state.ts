/**
 * The form state every assignment-authoring server action returns.
 *
 * Lives in its own module rather than in lib/actions/assignments.ts because
 * the parsing and validation helpers under lib/assignments/ return it, and a
 * plain module should not have to reach into a "use server" module to name
 * its own return type.
 *
 * Re-exported from lib/actions/assignments.ts so existing consumers
 * (assignment-form.tsx, delete-assignment-button.tsx,
 * publish-toggle-button.tsx) keep their current import path.
 */

export type AssignmentFormState = {
  error?: string;
  fieldErrors?: {
    title?: string;
    prompt?: string;
    num_body_paragraphs?: string;
    default_chunks_per_bp?: string;
    due_at?: string;
    class_periods?: string;
    rubric?: string;
    rubric_file?: string;
  };
  success?: string;
};
