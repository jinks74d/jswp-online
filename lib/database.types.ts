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
        | "school_admin"
        | "teacher"
        | "student";
      jswp_writing_status:
        | "draft"
        | "in_progress"
        | "submitted"
        | "returned"
        | "graded";
      jswp_chunk_ratio:
        | "two_plus_to_one"
        | "one_to_two_plus"
        | "three_plus_to_zero";
      jswp_narrative_kind: "personal" | "fictional";
      jswp_narrative_subject: "event" | "person" | "place" | "thing";
      jswp_thesis_frame:
        | "open"
        | "framed_but"
        | "framed_although"
        | "three_pronged";
      jswp_cm_kind: "word" | "phrase" | "sentence";
      jswp_annotation_kind: "cd" | "cm" | "transition" | "note";
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
} & Timestamps;

export type Schools = {
  id: string;
  district_id: string;
  name: string;
  level: string | null;
  active: boolean;
} & Timestamps;

export type UserProfiles = {
  id: string;
  district_id: string;
  school_id: string | null;
  role: Database["public"]["Enums"]["jswp_role"];
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  student_id_external: string | null;
  grade_level: string | null;
  active: boolean;
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

  source_text: string | null;
  source_title: string | null;
  source_author: string | null;
  source_citation: string | null;
  source_url: string | null;

  due_at: string | null;
  allow_multiple_drafts: boolean;
  max_drafts: number | null;
  released_at: string | null;
  closed_at: string | null;

  rubric: Json | null;
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
} & Timestamps;

export type TextAnnotations = {
  id: string;
  student_writing_id: string;
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
  narrative_where: string | null;
  narrative_who: string | null;
  narrative_what_happened: string | null;
  narrative_dialogue: string | null;
  narrative_feeling: string | null;
  narrative_thinking: string | null;
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
  notes: string | null;
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
  word_count: number | null;
} & Timestamps;

export type FinalDrafts = {
  id: string;
  student_writing_id: string;
  title: string | null;
  full_text: string;
  word_count: number | null;
} & Timestamps;

export type StepProgress = {
  id: string;
  student_writing_id: string;
  step_key: string;
  started_at: string | null;
  completed_at: string | null;
  time_spent_seconds: number;
} & Timestamps;

export type TeacherFeedback = {
  id: string;
  student_writing_id: string;
  teacher_id: string;
  target_kind: Database["public"]["Enums"]["jswp_feedback_target"];
  target_id: string;
  body: string;
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
