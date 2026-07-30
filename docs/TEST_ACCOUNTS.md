# Test Accounts (v2 preview DB)

> Seeded **2026-06-22** into the live **v2** Supabase project `jswp-online-v2`
> (`hcdvypzfzrzevkwkssiw`) — the Vercel **preview** database, NOT legacy
> production. Demo LACOE District (`…0001`) / Demo High School (`…0010`),
> subject English. For local/preview testing only.

**Password for ALL six accounts below:** `Test1234!`

## Teachers → assigned student

| # | Teacher login | Class · Period | Student login |
|---|---|---|---|
| 1 | `teacher1@seed.test` | Test Class — Teacher One · Period 1 | `student1@seed.test` |
| 2 | `teacher2@seed.test` | Test Class — Teacher Two · Period 1 | `student2@seed.test` |
| 3 | `teacher3@seed.test` | Test Class — Teacher Three · Period 1 | `student3@seed.test` |

Each student is assigned to its teacher by being enrolled in that teacher's
Period 1 (`class_teacher_assignments` for the teacher, `class_student_enrollments`
for the student — both pointing at the same `class_period`).

## Reference UUIDs

| Entity | UUID pattern |
|---|---|
| Teachers 1–3 | `11111111-1111-4111-8111-00000000000{1,2,3}` |
| Students 1–3 | `22222222-2222-4222-8222-00000000000{1,2,3}` |
| Classes 1–3 | `33333333-3333-4333-8333-00000000000{1,2,3}` |
| Class periods 1–3 | `44444444-4444-4444-8444-00000000000{1,2,3}` |
| District / School / Subject | `…0001` / `…0010` / `…1000` (English) |

## Notes

- Auth users were created directly in `auth.users` + `auth.identities` with
  bcrypt'd passwords and confirmed emails, so they log in immediately.
- Profiles: teachers `role=teacher`; students `role=student` (grade 10).
- The seed is idempotent (`ON CONFLICT DO NOTHING`) — safe to re-run.
- These are separate from the original demo accounts in `scripts/seed-auth.ts`
  (`@demo.test`); the new ones use the `@seed.test` domain.
- ⚠️ Test credentials for a preview DB only. Do not reuse this password pattern
  for any real/production account.
