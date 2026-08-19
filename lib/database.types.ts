/**
 * JSWP Online — Database Types
 * ─────────────────────────────────────────────────────────────────────────
 * Hand-written to match the schema in migrations/0001_init_jswp_schema.sql.
 *
 * Once a live Supabase project is provisioned, regenerate via:
 *   npx supabase gen types typescript --project-id <id> --schema public \
 *     > lib/database.types.ts
 *
 * The generated file will be functionally identical to this one. We commit
 * the hand-written version so app code can compile before the project is
 * provisioned.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/* ─── Helpers ────────────────────────────────────────────────────────── */

type Timestamps = {
  created_at: string;
  updated_at: string;
};

type InsertOf<R, Required extends keyof R = never> = Partial<R> & Pick<R, Required>;
type UpdateOf<R> = Partial<R>;

/* ─── Database root ──────────────────────────────────────────────────── */

export interface Database {
  public: {
    Tables: {
      districts: {
        Row: Districts;
        Insert: InsertOf<Districts, "name">;
        Update: UpdateOf<Districts>;
        Relationships: [];
      };
      schools: {
        Row: Schools;
        Insert: InsertOf<Schools, "district_id" | "name">;
        Update: UpdateOf<Schools>;
        Relationships: [
          {
            foreignKeyName: "schools_district_id_fkey";
            columns: ["district_id"];
            referencedRelation: "districts";
            referencedColumns: ["id"];
          }
        ];
      };
      user_profiles: {
        Row: UserProfiles;
        Insert: InsertOf<UserProfiles, "id" | "district_id" | "role">;
        Update: UpdateOf<UserProfiles>;
        Relationships: [
          {
            foreignKeyName: "user_profiles_district_id_fkey";
            columns: ["district_id"];
            referencedRelation: "districts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["id"];
          }
        ];
      };
      subjects: {
        Row: Subjects;
        Insert: InsertOf<Subjects, "school_id" | "name">;
        Update: UpdateOf<Subjects>;
        Relationships: [];
      };
      classes: {
        Row: Classes;
        Insert: InsertOf<Classes, "subject_id" | "school_id" | "name">;
        Update: UpdateOf<Classes>;
        Relationships: [];
      };
      class_periods: {
        Row: ClassPeriods;
        Insert: InsertOf<ClassPeriods, "class_id" | "school_id" | "period_label">;
        Update: UpdateOf<ClassPeriods>;
        Relationships: [];
      };
      class_teacher_assignments: {
        Row: ClassTeacherAssignments;
        Insert: InsertOf<ClassTeacherAssignments, "class_period_id" | "teacher_id">;
        Update: UpdateOf<ClassTeacherAssignments>;
        Relationships: [];
      };
      class_student_enrollments: {
        Row: ClassStudentEnrollments;
        Insert: InsertOf<ClassStudentEnrollments, "class_period_id" | "student_id">;
        Update: UpdateOf<ClassStudentEnrollments>;
        Relationships: [];
      };
      assignments: {
        Row: Assignments;
        Insert: InsertOf<
          Assignments,
          | "teacher_id"
          | "district_id"
          | "school_id"
          | "title"
          | "prompt"
          | "mode"
          | "default_chunk_ratio"
        >;
        Update: UpdateOf<Assignments>;
        Relationships: [];
      };
      assignment_class_periods: {
        Row: AssignmentClassPeriods;
        Insert: InsertOf<
          AssignmentClassPeriods,
          "assignment_id" | "class_period_id"
        >;
        Update: UpdateOf<AssignmentClassPeriods>;
        Relationships: [
          {
            foreignKeyName: "assignment_class_periods_assignment_id_fkey";
            columns: ["assignment_id"];
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_class_periods_class_period_id_fkey";
            columns: ["class_period_id"];
            referencedRelation: "class_periods";
            referencedColumns: ["id"];
          }
        ];
      };
      assignment_sources: {
        Row: AssignmentSources;
        Insert: InsertOf<AssignmentSources, "assignment_id" | "position">;
        Update: UpdateOf<AssignmentSources>;
        Relationships: [
          {
            foreignKeyName: "assignment_sources_assignment_id_fkey";
            columns: ["assignment_id"];
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          }
        ];
      };
      student_writings: {
        Row: StudentWritings;
        Insert: InsertOf<
          StudentWritings,
          "assignment_id" | "student_id" | "chunk_ratio"
        >;
        Update: UpdateOf<StudentWritings>;
        Relationships: [];
      };
      prompt_decodings: {
        Row: PromptDecodings;
        Insert: InsertOf<PromptDecodings, "student_writing_id">;
        Update: UpdateOf<PromptDecodings>;
        Relationships: [];
      };
      text_annotations: {
        Row: TextAnnotations;
        Insert: InsertOf<
          TextAnnotations,
          "student_writing_id" | "range_start" | "range_end" | "selected_text" | "kind"
        >;
        Update: UpdateOf<TextAnnotations>;
        Relationships: [];
      };
      gathering_cds_sheets: {
        Row: GatheringCdsSheets;
        Insert: InsertOf<
          GatheringCdsSheets,
          "student_writing_id" | "body_paragraph_position"
        >;
        Update: UpdateOf<GatheringCdsSheets>;
        Relationships: [];
      };
      candidate_cds: {
        Row: CandidateCds;
        Insert: InsertOf<CandidateCds, "gathering_sheet_id" | "position" | "text">;
        Update: UpdateOf<CandidateCds>;
        Relationships: [];
      };
      body_paragraphs: {
        Row: BodyParagraphs;
        Insert: InsertOf<BodyParagraphs, "student_writing_id" | "position">;
        Update: UpdateOf<BodyParagraphs>;
        Relationships: [];
      };
      t_charts: {
        Row: TCharts;
        Insert: InsertOf<TCharts, "body_paragraph_id">;
        Update: UpdateOf<TCharts>;
        Relationships: [];
      };
      chunks: {
        Row: Chunks;
        Insert: InsertOf<Chunks, "body_paragraph_id" | "position" | "ratio">;
        Update: UpdateOf<Chunks>;
        Relationships: [];
      };
      concrete_details: {
        Row: ConcreteDetails;
        Insert: InsertOf<ConcreteDetails, "chunk_id" | "position" | "text">;
        Update: UpdateOf<ConcreteDetails>;
        Relationships: [];
      };
      commentary_items: {
        Row: CommentaryItems;
        Insert: InsertOf<CommentaryItems, "chunk_id" | "position" | "text" | "kind">;
        Update: UpdateOf<CommentaryItems>;
        Relationships: [];
      };
      shaping_sheets: {
        Row: ShapingSheets;
        Insert: InsertOf<ShapingSheets, "body_paragraph_id">;
        Update: UpdateOf<ShapingSheets>;
        Relationships: [];
      };
      shaping_chunk_outputs: {
        Row: ShapingChunkOutputs;
        Insert: InsertOf<ShapingChunkOutputs, "shaping_sheet_id" | "chunk_id">;
        Update: UpdateOf<ShapingChunkOutputs>;
        Relationships: [];
      };
      essay_parts: {
        Row: EssayParts;
        Insert: InsertOf<EssayParts, "student_writing_id">;
        Update: UpdateOf<EssayParts>;
        Relationships: [];
      };
      paragraph_forms: {
        Row: ParagraphForms;
        Insert: InsertOf<ParagraphForms, "body_paragraph_id" | "final_text">;
        Update: UpdateOf<ParagraphForms>;
        Relationships: [];
      };
      final_drafts: {
        Row: FinalDrafts;
        Insert: InsertOf<FinalDrafts, "student_writing_id" | "full_text">;
        Update: UpdateOf<FinalDrafts>;
        Relationships: [];
      };
      step_progress: {
        Row: StepProgress;
        Insert: InsertOf<StepProgress, "student_writing_id" | "step_key">;
        Update: UpdateOf<StepProgress>;
        Relationships: [];
      };
      teacher_feedback: {
        Row: TeacherFeedback;
        Insert: InsertOf<
          TeacherFeedback,
          "student_writing_id" | "teacher_id" | "target_kind" | "target_id" | "body"
        >;
        Update: UpdateOf<TeacherFeedback>;
        Relationships: [];
      };
      rubric_scores: {
        Row: RubricScores;
        Insert: InsertOf<
          RubricScores,
          "student_writing_id" | "criterion_id" | "criterion_name" | "max_score" | "score"
        >;
        Update: UpdateOf<RubricScores>;
        Relationships: [];
      };
      exemplars: {
        Row: Exemplars;
        Insert: InsertOf<
          Exemplars,
          "district_id" | "school_id" | "title" | "mode" | "full_text"
        >;
        Update: UpdateOf<Exemplars>;
        Relationships: [];
      };
      assignment_exemplars: {
        Row: AssignmentExemplars;
        Insert: InsertOf<
          AssignmentExemplars,
          "assignment_id" | "exemplar_id"
        >;
        Update: UpdateOf<AssignmentExemplars>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLog;
        Insert: InsertOf<AuditLog, "actor_id" | "action">;
        Update: UpdateOf<AuditLog>;
        Relationships: [];
      };
      district_access_grants: {
        Row: DistrictAccessGrants;
        // No Update: the row has no mutable field. A changed grant is a
        // delete plus an insert, and both are service-role only (0061 §5).
        Insert: InsertOf<
          DistrictAccessGrants,
          "user_id" | "district_id" | "granted_by"
        >;
        Update: UpdateOf<DistrictAccessGrants>;
        Relationships: [];
      };
      signup_requests: {
        Row: SignupRequests;
        Insert: InsertOf<
          SignupRequests,
          "auth_user_id" | "email" | "first_name" | "last_name"
        >;
        Update: UpdateOf<SignupRequests>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      /** 0052 — atomic delete+insert of an assignment's class periods. */
      replace_assignment_class_periods: {
        Args: {
          p_assignment_id: string;
          p_periods: { class_period_id: string; due_at: string | null }[];
        };
        Returns: undefined;
      };
      /** 0053 — assignment row + its class periods in one transaction. */
      save_assignment_with_periods: {
        Args: {
          p_assignment_id: string;
          p_teacher_id: string;
          p_periods: { class_period_id: string; due_at: string | null }[];
          /** true = replace the period set (draft); false = merge (published). */
          p_replace: boolean;
          p_update: Json;
        };
        Returns: undefined;
      };
      /**
       * 0061 — aggregate-only district analytics. SECURITY DEFINER, gated on
       * auth_user_can_view_district(). Raises 42501 when unauthorized rather
       * than returning an empty row.
       *
       * Returns numerators and denominators, never rates — the UI divides via
       * rate() in lib/queries/district-analytics.ts. Extend this, the RETURNS
       * TABLE in the migration, and DistrictAnalytics together; the three are
       * one contract.
       */
      get_district_analytics: {
        Args: {
          p_district_id: string;
          p_since?: string;
          p_until?: string;
        };
        Returns: {
          district_id: string;
          district_name: string;
          window_since: string;
          window_until: string;
          schools: number;
          teachers: number;
          students: number;
          teachers_active: number;
          students_active: number;
          writings_started: number;
          writings_completed: number;
          assignments_total: number;
          assignments_expository: number;
          assignments_argumentation: number;
          assignments_literary: number;
          assignments_narrative: number;
          writings_graded: number;
          median_days_to_feedback: number | null;
          writings_submitted: number;
          writings_revised: number;
        }[];
      };
      /**
       * 0061 — per-step completion counts for a district cohort. Returned
       * UNORDERED by design: step ordering lives only in lib/jswp-modes.ts
       * (CLAUDE.md §7), so stall step and skip rate are derived in TypeScript.
       */
      get_district_step_funnel: {
        Args: {
          p_district_id: string;
          p_since?: string;
          p_until?: string;
        };
        Returns: {
          mode: Database["public"]["Enums"]["jswp_mode"];
          step_key: string;
          writings_reached: number;
          mode_writings_total: number;
        }[];
      };
      /** 0061 — READ-ONLY scope check. Never use in a WITH CHECK clause. */
      auth_user_can_view_district: {
        Args: { d_id: string };
        Returns: boolean;
      };
      auth_user_role: {
        Args: Record<string, never>;
        Returns: Database["public"]["Enums"]["jswp_role"] | null;
      };
      auth_user_district_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      auth_user_school_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      auth_user_teaches_class_period: {
        Args: { cp_id: string };
        Returns: boolean;
      };
      auth_user_enrolled_in_class_period: {
        Args: { cp_id: string };
        Returns: boolean;
      };
      auth_user_is_admin_for_district: {
        Args: { d_id: string };
        Returns: boolean;
      };
      auth_user_is_admin_for_school: {
        Args: { s_id: string };
        Returns: boolean;
      };
      auth_user_can_read_writing: {
        Args: { w_id: string };
        Returns: boolean;
      };
      auth_user_can_write_writing: {
        Args: { w_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      jswp_mode: "expository" | "argumentation" | "literary" | "narrative";
      jswp_role:
        | "super_admin"
        | "district_admin"
        // 0061 — read-only, multi-district analytics viewer. Deliberately a
        // distinct value so every existing `=== "district_admin"` check keeps
        // excluding it; access is opted in one surface at a time.
        | "district_analyst"
        | "school_admin"
        | "teacher"
        | "student";
      jswp_admin_kind: "administrator" | "counselor" | "other";
      jswp_writing_status:
        | "draft"
        | "in_progress"
        | "submitted"
        | "returned"
        | "graded";
      jswp_chunk_ratio:
        | "lit_one_to_two_plus"
        | "lit_three_plus_to_zero"
        | "nar_two_plus_to_one"
        | "nonlit_summary_three_plus_to_zero"
        | "nonlit_expository_two_plus_to_one"
        | "nonlit_argumentation_two_plus_to_one"
        | "nonlit_expository_one_to_one";
      jswp_narrative_kind: "personal" | "fictional";
      jswp_narrative_subject: "event" | "person" | "place" | "thing";
      jswp_thesis_frame:
        | "open"
        | "framed_but"
        | "framed_although"
        | "three_pronged";
      jswp_cm_kind: "word" | "phrase" | "sentence";
      jswp_annotation_kind: "cd" | "cm" | "transition" | "note" | "main_idea";
      jswp_signup_status: "pending" | "approved" | "denied";
      jswp_feedback_target:
        | "student_writing"
        | "prompt_decoding"
        | "gathering_sheet"
        | "candidate_cd"
        | "body_paragraph"
        | "t_chart"
        | "chunk"
        | "concrete_detail"
        | "commentary_item"
        | "shaping_sheet"
        | "paragraph_form"
        | "essay_parts"
        | "final_draft";
      jswp_grade_format: "none" | "number" | "letter" | "check";
    };
  };
}

/* ─── Row types ─────────────────────────────────────────────────────── */

export type Districts = {
  id: string;
  name: string;
  subdomain: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  contact_email: string | null;
  active: boolean;
  // The two required Points of Contact (district_admin accounts). Nullable at
  // the DB level to break the circular FK; the create action always sets both.
  primary_poc_id: string | null;
  secondary_poc_id: string | null;
} & Timestamps;

export type Schools = {
  id: string;
  district_id: string;
  name: string;
  level: string | null;
  active: boolean;
  address: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
} & Timestamps;

export type UserProfiles = {
  id: string;
  district_id: string | null; // NULL for super_admin (platform owners, no district)
  school_id: string | null;
  role: Database["public"]["Enums"]["jswp_role"];
  // Only set when role = 'school_admin'; drives which dashboard they land on.
  admin_kind: Database["public"]["Enums"]["jswp_admin_kind"] | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  student_id_external: string | null;
  teacher_id_external: string | null;
  grade_level: string | null;
  active: boolean;
  // When the set-password invite email was last sent; NULL = never invited.
  invited_at: string | null;
} & Timestamps;

export type Subjects = {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
} & Timestamps;

export type Classes = {
  id: string;
  subject_id: string;
  school_id: string;
  name: string;
  description: string | null;
} & Timestamps;

export type ClassPeriods = {
  id: string;
  class_id: string;
  school_id: string;
  period_label: string;
  academic_year: string | null;
  created_by: string | null;
} & Timestamps;

export type ClassTeacherAssignments = {
  class_period_id: string;
  teacher_id: string;
  is_primary: boolean;
  assigned_by: string | null;
  assigned_at: string;
};

export type ClassStudentEnrollments = {
  class_period_id: string;
  student_id: string;
  enrolled_at: string;
  unenrolled_at: string | null;
};

export type Assignments = {
  id: string;
  teacher_id: string;
  class_period_id: string | null;
  district_id: string;
  school_id: string;

  title: string;
  prompt: string;
  mode: Database["public"]["Enums"]["jswp_mode"];

  is_essay: boolean;
  num_body_paragraphs: number;
  default_chunk_ratio: Database["public"]["Enums"]["jswp_chunk_ratio"];
  default_chunks_per_bp: number;
  has_counterargument: boolean;

  due_at: string | null;
  allow_multiple_drafts: boolean;
  max_drafts: number | null;
  released_at: string | null;
  closed_at: string | null;

  rubric: Json | null;

  /** Attached rubric document (migration 0049) — reference only, not scored
   *  against. path/name are set together or both null (CHECK constraint). */
  rubric_file_path: string | null;
  rubric_file_name: string | null;
  rubric_file_mime: string | null;
} & Timestamps;

/**
 * One (assignment, class period) pairing — migration 0050. An assignment is
 * assigned to as many periods as the teacher selects.
 *
 * `due_at` is that period's own deadline; NULL inherits `assignments.due_at`.
 * Resolve it with `effectiveDueAt` in lib/assignment-due-dates.ts rather than
 * reading this column directly.
 */
export type AssignmentClassPeriods = {
  assignment_id: string;
  class_period_id: string;
  due_at: string | null;
} & Timestamps;

export type AssignmentSources = {
  id: string;
  assignment_id: string;
  position: number;
  kind: "primary" | "secondary";

  source_text: string | null;
  source_title: string | null;
  source_author: string | null;
  source_citation: string | null;
  source_url: string | null;
  source_html: string | null;
  source_render_mode: "pdf" | "rich" | "plain" | "image" | null;
  source_file_path: string | null;
  source_file_name: string | null;
  source_file_mime: string | null;
} & Timestamps;

export type StudentWritings = {
  id: string;
  assignment_id: string;
  student_id: string;
  draft_number: number;
  status: Database["public"]["Enums"]["jswp_writing_status"];
  current_step: string | null;
  chunk_ratio: Database["public"]["Enums"]["jswp_chunk_ratio"];
  submitted_at: string | null;
  returned_at: string | null;
  graded_at: string | null;
  total_score: number | null;
  // Feedback-area grading (migration 0031) — independent of total_score.
  grade_format: Database["public"]["Enums"]["jswp_grade_format"];
  overall_grade: string | null;
  // When the OWNING STUDENT last changed any artifact of this writing
  // (migration 0054). Distinct from updated_at, which also moves on teacher
  // writes; compared against returned_at to flag a revision after feedback.
  last_student_edit_at: string | null;
} & Timestamps;

export type PromptDecodings = {
  id: string;
  student_writing_id: string;
  task: string | null;
  form: string | null;
  ratio_identified: Database["public"]["Enums"]["jswp_chunk_ratio"] | null;
  key_verbs: string[] | null;
  focus_terms: string[] | null;
  notes: string | null;
  background_text: string | null;
  trigger_text: string | null;
  cd_source: string | null;
} & Timestamps;

export type TextAnnotations = {
  id: string;
  student_writing_id: string;
  source_id: string | null;
  range_start: number;
  range_end: number;
  selected_text: string;
  kind: Database["public"]["Enums"]["jswp_annotation_kind"];
  note: string | null;
  created_at: string;
};

export type GatheringCdsSheets = {
  id: string;
  student_writing_id: string;
  body_paragraph_position: number;
  task_portion: string | null;
} & Timestamps;

export type CandidateCds = {
  id: string;
  gathering_sheet_id: string;
  position: number;
  text: string;
  is_selected: boolean;
  selection_order: number | null;
  argumentation_side: "pro" | "con" | "neutral" | null;
} & Timestamps;

export type BodyParagraphs = {
  id: string;
  student_writing_id: string;
  position: number;
  label: string | null;
  num_chunks: number;
  has_counterargument: boolean;
} & Timestamps;

export type TCharts = {
  id: string;
  body_paragraph_id: string;
  working_topic_sentence: string | null;
  revised_topic_sentence: string | null;
  // The T-Chart's full-width COMMENTARY SENTENCE row (migration 0044) —
  // distinct from commentary_items.text (the per-CD CM clouds).
  commentary_sentence: string | null;
  concluding_sentence: string | null;
  concession: string | null;
  counterargument: string | null;
  refutation: string | null;
  narrative_kind: Database["public"]["Enums"]["jswp_narrative_kind"] | null;
  narrative_subject: Database["public"]["Enums"]["jswp_narrative_subject"] | null;
  narrative_key_word: string | null;
  narrative_general_ideas: string[] | null;
  narrative_concrete_example: string | null;
  narrative_when: string | null;
  narrative_when_details: string | null;
  narrative_where: string | null;
  narrative_where_details: string | null;
  narrative_who: string | null;
  narrative_who_details: string | null;
  narrative_what_happened: string | null;
  narrative_dialogue: string | null;
  narrative_feeling: string | null;
  narrative_thinking: string | null;
  narrative_thinking_2: string | null;
  abc_character: string | null;
  abc_setting: string | null;
  abc_back_story: string | null;
  abc_conflict: string | null;
  abc_end: string | null;
} & Timestamps;

export type Chunks = {
  id: string;
  body_paragraph_id: string;
  position: number;
  ratio: Database["public"]["Enums"]["jswp_chunk_ratio"];
} & Timestamps;

export type ConcreteDetails = {
  id: string;
  chunk_id: string;
  position: number;
  text: string;
  is_quotation: boolean;
  transitional_lead_in: string | null;
  source_citation: string | null;
  candidate_cd_id: string | null;
} & Timestamps;

export type CommentaryItems = {
  id: string;
  chunk_id: string;
  parent_cd_id: string | null;
  position: number;
  text: string;
  kind: Database["public"]["Enums"]["jswp_cm_kind"];
  used_in_topic_sentence: boolean;
  used_in_cm_sentence: boolean;
  used_in_concluding_sentence: boolean;
  is_best_word_for_ts: boolean;
  is_best_word_for_chunk: boolean;
  // Migration 0032: WOW synonym (box #2) and parent word link for phrase rows (clouds, box #3)
  synonym: string | null;
  parent_cm_id: string | null;
  // Migration 0037: up to 4 brainstormed supporting words on the Expository CM cloud's rays
  web_words: string[] | null;
  // Migration 0045: index-aligned with web_words — where each ray was spent
  // ("ts" | "cm" | "cs" | "" ). See lib/pick-n-stitch.ts.
  web_word_uses: string[] | null;
} & Timestamps;

export type ShapingSheets = {
  id: string;
  body_paragraph_id: string;
  final_topic_sentence: string | null;
  final_concession: string | null;
  final_counterargument: string | null;
  final_refutation: string | null;
  final_concluding_sentence: string | null;
  rules_applied: string[] | null;
  revision_moves: string[] | null;
  notes: string | null;
  narrative_shaping_cd1: string | null;
  narrative_shaping_cd2: string | null;
  narrative_shaping_cm: string | null;
} & Timestamps;

export type ShapingChunkOutputs = {
  id: string;
  shaping_sheet_id: string;
  chunk_id: string;
  cd_sentences: string[] | null;
  cm_sentences: string[] | null;
} & Timestamps;

export type EssayParts = {
  id: string;
  student_writing_id: string;
  thesis_text: string | null;
  thesis_frame: Database["public"]["Enums"]["jswp_thesis_frame"] | null;
  introduction_text: string | null;
  introduction_hook_kind: string | null;
  conclusion_text: string | null;
} & Timestamps;

export type ParagraphForms = {
  id: string;
  body_paragraph_id: string;
  final_text: string;
  // False = final_text auto-syncs from the composed paragraph on each
  // Paragraph Form visit. True = student hand-edited the fine-tune box;
  // preserve their wording. Migration 0029.
  final_text_customized: boolean;
  word_count: number | null;
} & Timestamps;

export type FinalDrafts = {
  id: string;
  student_writing_id: string;
  title: string | null;
  full_text: string;
  word_count: number | null;
  // Migration 0032: mirrors shaping_sheets.revision_moves; student self-check list
  self_checks: string[] | null;
} & Timestamps;

export type StepProgress = {
  id: string;
  student_writing_id: string;
  step_key: string;
  started_at: string | null;
  completed_at: string | null;
  // When the student last submitted THIS STEP for grading (migration 0055).
  // Distinct from completed_at, which only means they clicked Continue past it.
  submitted_at: string | null;
  time_spent_seconds: number;
} & Timestamps;

export type TeacherFeedback = {
  id: string;
  student_writing_id: string;
  teacher_id: string;
  target_kind: Database["public"]["Enums"]["jswp_feedback_target"];
  target_id: string;
  body: string;
  // Section anchor: step key a section note targets; NULL = overall
  // whole-writing comment (the threaded panel). Migration 0030.
  step_key: string | null;
  // Per-section feedback grade (migration 0031); interpreted per grade_format.
  grade_value: string | null;
  rubric_score: number | null;
  is_resolved: boolean;
} & Timestamps;

export type RubricScores = {
  id: string;
  student_writing_id: string;
  criterion_id: string;
  criterion_name: string;
  max_score: number;
  score: number;
  level_label: string | null;
  comment: string | null;
} & Timestamps;

export type Exemplars = {
  id: string;
  district_id: string;
  school_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  mode: Database["public"]["Enums"]["jswp_mode"];
  full_text: string;
  is_published: boolean;
  shared_with_school: boolean;
  step_tags: string[] | null;
  content_format: "plain" | "html";
} & Timestamps;

export type AssignmentExemplars = {
  assignment_id: string;
  exemplar_id: string;
  position: number;
  pinned_by: string | null;
  pinned_at: string;
};

export type AuditLog = {
  id: string;
  actor_id: string;
  action: string;
  target_scope: Json | null;
  metadata: Json | null;
  district_id: string | null;
  school_id: string | null;
  created_at: string;
};

/** 0061 — additive read-only district scope. See migration header. */
export type DistrictAccessGrants = {
  user_id: string;
  district_id: string;
  granted_by: string;
  created_at: string;
};

export type SignupRequests = {
  id: string;
  auth_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  requested_role: Database["public"]["Enums"]["jswp_role"];
  requested_district_id: string | null;
  requested_school_id: string | null;
  message: string | null;
  status: Database["public"]["Enums"]["jswp_signup_status"];
  decided_by: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  denial_reason: string | null;
} & Timestamps;

/* ─── Convenience aliases for consumers ──────────────────────────────── */

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
