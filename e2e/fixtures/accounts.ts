/**
 * Seeded accounts and where their banked sessions live.
 *
 * These are the demo users scripts/seed-auth.ts creates. They are test
 * fixtures against a dev Supabase project, not secrets — but they are read
 * from the environment first so a different project can be pointed at without
 * editing source.
 */

export const STORAGE_STATE = {
  student: "e2e/.auth/student.json",
  teacher: "e2e/.auth/teacher.json",
} as const;

export const CREDENTIALS = {
  student: {
    email: process.env.E2E_STUDENT_EMAIL ?? "alex@demo.test",
    password: process.env.E2E_STUDENT_PASSWORD ?? "Student1!",
  },
  teacher: {
    email: process.env.E2E_TEACHER_EMAIL ?? "teacher@demo.test",
    password: process.env.E2E_TEACHER_PASSWORD ?? "Teacher1!",
  },
} as const;
