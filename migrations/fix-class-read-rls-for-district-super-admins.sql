-- Fix: district admins and super admins could not read class data.
--
-- Root cause: the only SELECT/ALL policies on class_periods, classes and
-- subjects required user_profiles.school_id = <table>.school_id. District
-- admins have school_id = NULL (they are scoped to a district), so those
-- policies matched zero rows, and super admins had no policy at all. As a
-- result /dashboard/classes showed nothing for district/super admins.
--
-- These additive, read-only policies scope district admins to the schools in
-- their district (class_periods/classes/subjects have school_id, so we join
-- through schools.district_id) and give super admins read access to all rows.
-- Uses the existing SECURITY DEFINER helpers get_user_role()/get_user_district_id().

-- class_periods
CREATE POLICY "District admins can view class periods in their district" ON class_periods
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'district_admin'::user_role
    AND EXISTS (
      SELECT 1 FROM schools s
      WHERE s.id = class_periods.school_id
        AND s.district_id = get_user_district_id()
    )
  );

CREATE POLICY "Super admins can view all class periods" ON class_periods
  FOR SELECT TO authenticated
  USING (get_user_role() = 'super_admin'::user_role);

-- classes
CREATE POLICY "District admins can view classes in their district" ON classes
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'district_admin'::user_role
    AND EXISTS (
      SELECT 1 FROM schools s
      WHERE s.id = classes.school_id
        AND s.district_id = get_user_district_id()
    )
  );

CREATE POLICY "Super admins can view all classes" ON classes
  FOR SELECT TO authenticated
  USING (get_user_role() = 'super_admin'::user_role);

-- subjects
CREATE POLICY "District admins can view subjects in their district" ON subjects
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'district_admin'::user_role
    AND EXISTS (
      SELECT 1 FROM schools s
      WHERE s.id = subjects.school_id
        AND s.district_id = get_user_district_id()
    )
  );

CREATE POLICY "Super admins can view all subjects" ON subjects
  FOR SELECT TO authenticated
  USING (get_user_role() = 'super_admin'::user_role);
