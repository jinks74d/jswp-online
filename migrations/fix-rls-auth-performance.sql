-- Fix for Supabase performance warning: Auth RLS Initialization Plan
-- This script optimizes RLS policies to prevent re-evaluation of auth functions for each row

-- Issue: RLS policy "District admins can manage all assignments in their district" 
-- on table public.teacher_student_assignments re-evaluates auth functions for each row
-- causing suboptimal query performance at scale

-- First, let's see the current RLS policies on the table
-- You can run this query to check existing policies:
-- SELECT schemaname, tablename, policyname, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename = 'teacher_student_assignments';

-- The issue is likely in a policy that uses auth.uid() or get_user_district_id() directly
-- We need to wrap these function calls in subqueries to evaluate them only once per query

-- Example of the problematic pattern:
-- CREATE POLICY "District admins can manage all assignments in their district" 
-- ON public.teacher_student_assignments
-- FOR ALL USING (
--     get_user_district_id() = district_id AND get_user_role() = 'district_admin'
-- );

-- OPTIMIZED VERSION: Wrap auth functions in subqueries
-- This evaluates the functions once per query instead of once per row

-- Current policies found that need optimization:
-- All policies use auth.uid() directly in EXISTS clauses, causing per-row evaluation

-- 1. Optimize "District admins can manage all assignments in their district"
DROP POLICY IF EXISTS "District admins can manage all assignments in their district" ON public.teacher_student_assignments;

CREATE POLICY "District admins can manage all assignments in their district" 
ON public.teacher_student_assignments
FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM user_profiles up
        WHERE up.id = (SELECT auth.uid()) 
        AND up.role = 'district_admin'::user_role 
        AND up.district_id IN (
            SELECT t.district_id
            FROM user_profiles t
            WHERE t.id = teacher_student_assignments.teacher_id
            UNION
            SELECT s.district_id
            FROM user_profiles s
            WHERE s.id = teacher_student_assignments.student_id
        )
    )
);

-- 2. Optimize "School admins can manage assignments in their school"
DROP POLICY IF EXISTS "School admins can manage assignments in their school" ON public.teacher_student_assignments;

CREATE POLICY "School admins can manage assignments in their school" 
ON public.teacher_student_assignments
FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM user_profiles up
        WHERE up.id = (SELECT auth.uid()) 
        AND up.role = 'school_admin'::user_role 
        AND up.school_id IN (
            SELECT t.school_id
            FROM user_profiles t
            WHERE t.id = teacher_student_assignments.teacher_id
            UNION
            SELECT s.school_id
            FROM user_profiles s
            WHERE s.id = teacher_student_assignments.student_id
        )
    )
);

-- 3. Optimize "Students can see their own assignments"
DROP POLICY IF EXISTS "Students can see their own assignments" ON public.teacher_student_assignments;

CREATE POLICY "Students can see their own assignments" 
ON public.teacher_student_assignments
FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM user_profiles up
        WHERE up.id = (SELECT auth.uid()) 
        AND up.role = 'student'::user_role 
        AND up.id = teacher_student_assignments.student_id
    )
);

-- 4. Optimize "Teachers can see their own assignments"
DROP POLICY IF EXISTS "Teachers can see their own assignments" ON public.teacher_student_assignments;

CREATE POLICY "Teachers can see their own assignments" 
ON public.teacher_student_assignments
FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM user_profiles up
        WHERE up.id = (SELECT auth.uid()) 
        AND up.role = 'teacher'::user_role 
        AND up.id = teacher_student_assignments.teacher_id
    )
);

-- Alternative approach if the above doesn't work:
-- You can also use WITH clauses for more complex scenarios:
-- CREATE POLICY "District admins can manage all assignments in their district" 
-- ON public.teacher_student_assignments
-- FOR ALL USING (
--     district_id IN (
--         WITH user_context AS (
--             SELECT get_user_district_id() as user_district_id, 
--                    get_user_role() as user_role
--         )
--         SELECT user_district_id 
--         FROM user_context 
--         WHERE user_role = 'district_admin'
--     )
-- );

-- Performance optimization notes:
-- 1. (SELECT auth.uid()) - evaluates once per query instead of per row
-- 2. (SELECT get_user_role()) - evaluates once per query instead of per row  
-- 3. (SELECT get_user_district_id()) - evaluates once per query instead of per row
-- 4. This can provide significant performance improvements on large datasets

-- Check for other policies that might need similar optimization:
-- Look for policies using auth.uid(), current_setting(), get_user_role(), etc.
-- and apply the same subquery pattern to optimize them
