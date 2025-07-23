-- Complete Database Setup for Class Management System
-- Execute these commands in your Supabase SQL editor in order

-- =====================================================
-- STEP 1: CREATE TABLES
-- =====================================================

-- 1. Create subjects table
CREATE TABLE subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(name, school_id)
);

-- 2. Create classes table
CREATE TABLE classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(name, subject_id)
);

-- 3. Create class_periods table
CREATE TABLE class_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  period VARCHAR(50) NOT NULL,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(class_id, period)
);

-- 4. Create class_teacher_assignments table
CREATE TABLE class_teacher_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_period_id UUID NOT NULL REFERENCES class_periods(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES user_profiles(id),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(class_period_id, teacher_id)
);

-- =====================================================
-- STEP 2: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teacher_assignments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 3: CREATE RLS POLICIES
-- =====================================================

-- Subjects policies
CREATE POLICY "School admins can manage subjects in their school" ON subjects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = subjects.school_id 
      AND user_profiles.role IN ('school_admin', 'district_admin')
    )
  );

CREATE POLICY "Teachers can view subjects in their school" ON subjects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = subjects.school_id 
      AND user_profiles.role = 'teacher'
    )
  );

-- Classes policies
CREATE POLICY "School admins can manage classes in their school" ON classes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = classes.school_id 
      AND user_profiles.role IN ('school_admin', 'district_admin')
    )
  );

CREATE POLICY "Teachers can view classes in their school" ON classes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = classes.school_id 
      AND user_profiles.role = 'teacher'
    )
  );

-- Class periods policies
CREATE POLICY "School admins can manage class periods in their school" ON class_periods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = class_periods.school_id 
      AND user_profiles.role IN ('school_admin', 'district_admin')
    )
  );

CREATE POLICY "Teachers can view class periods in their school" ON class_periods
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = class_periods.school_id 
      AND user_profiles.role = 'teacher'
    )
  );

-- Class teacher assignments policies
CREATE POLICY "School admins can manage teacher assignments in their school" ON class_teacher_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = class_teacher_assignments.school_id 
      AND user_profiles.role IN ('school_admin', 'district_admin')
    )
  );

CREATE POLICY "Teachers can view their own assignments" ON class_teacher_assignments
  FOR SELECT USING (
    teacher_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = class_teacher_assignments.school_id 
      AND user_profiles.role IN ('school_admin', 'district_admin', 'teacher')
    )
  );

-- =====================================================
-- STEP 4: CREATE PERFORMANCE INDEXES
-- =====================================================

-- Subjects indexes
CREATE INDEX idx_subjects_school_id ON subjects(school_id);
CREATE INDEX idx_subjects_name ON subjects(name);

-- Classes indexes
CREATE INDEX idx_classes_subject_id ON classes(subject_id);
CREATE INDEX idx_classes_school_id ON classes(school_id);
CREATE INDEX idx_classes_name ON classes(name);

-- Class periods indexes
CREATE INDEX idx_class_periods_class_id ON class_periods(class_id);
CREATE INDEX idx_class_periods_school_id ON class_periods(school_id);
CREATE INDEX idx_class_periods_period ON class_periods(period);
CREATE INDEX idx_class_periods_created_by ON class_periods(created_by);

-- Class teacher assignments indexes
CREATE INDEX idx_class_teacher_assignments_class_period_id ON class_teacher_assignments(class_period_id);
CREATE INDEX idx_class_teacher_assignments_teacher_id ON class_teacher_assignments(teacher_id);
CREATE INDEX idx_class_teacher_assignments_school_id ON class_teacher_assignments(school_id);
CREATE INDEX idx_class_teacher_assignments_assigned_by ON class_teacher_assignments(assigned_by);

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
-- You can now use the class management system with teacher assignments.
-- Navigate to /dashboard/classes to get started.
