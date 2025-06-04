# Database Schema for Class Management System

## Overview
The class management system implements a hierarchical structure: **Subject → Classes → Periods**

## Required Tables

### 1. subjects
```sql
CREATE TABLE subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(name, school_id)
);
```

### 2. classes
```sql
CREATE TABLE classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(name, subject_id)
);
```

### 3. class_periods
```sql
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
```

### 4. class_teacher_assignments
```sql
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
```

## Row Level Security (RLS) Policies

### subjects table
```sql
-- Enable RLS
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- Policy for school admins and district admins
CREATE POLICY "School admins can manage subjects in their school" ON subjects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = subjects.school_id 
      AND user_profiles.role IN ('school_admin', 'district_admin')
    )
  );

-- Policy for teachers to view subjects in their school
CREATE POLICY "Teachers can view subjects in their school" ON subjects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = subjects.school_id 
      AND user_profiles.role = 'teacher'
    )
  );
```

### classes table
```sql
-- Enable RLS
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Policy for school admins and district admins
CREATE POLICY "School admins can manage classes in their school" ON classes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = classes.school_id 
      AND user_profiles.role IN ('school_admin', 'district_admin')
    )
  );

-- Policy for teachers to view classes in their school
CREATE POLICY "Teachers can view classes in their school" ON classes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = classes.school_id 
      AND user_profiles.role = 'teacher'
    )
  );
```

### class_periods table
```sql
-- Enable RLS
ALTER TABLE class_periods ENABLE ROW LEVEL SECURITY;

-- Policy for school admins and district admins
CREATE POLICY "School admins can manage class periods in their school" ON class_periods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = class_periods.school_id 
      AND user_profiles.role IN ('school_admin', 'district_admin')
    )
  );

-- Policy for teachers to view class periods in their school
CREATE POLICY "Teachers can view class periods in their school" ON class_periods
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = class_periods.school_id 
      AND user_profiles.role = 'teacher'
    )
  );
```

### class_teacher_assignments table
```sql
-- Enable RLS
ALTER TABLE class_teacher_assignments ENABLE ROW LEVEL SECURITY;

-- Policy for school admins and district admins
CREATE POLICY "School admins can manage teacher assignments in their school" ON class_teacher_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.school_id = class_teacher_assignments.school_id 
      AND user_profiles.role IN ('school_admin', 'district_admin')
    )
  );

-- Policy for teachers to view their own assignments
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
```

## Indexes for Performance
```sql
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
```

## Data Flow
1. **Subject Creation**: School admins can create subjects (e.g., "Mathematics", "Science")
2. **Class Creation**: Within each subject, classes can be created (e.g., "Algebra I", "Geometry")
3. **Period Assignment**: Each class can have multiple periods (e.g., "1", "2A", "3B", "Morning")

## API Endpoints Created
- `POST /api/dashboard/classes/create` - Creates a class period with subject and class validation
- `POST /api/dashboard/classes/[id]/assign-teacher` - Assigns a teacher to a class period
- `DELETE /api/dashboard/classes/[id]/assign-teacher` - Unassigns a teacher from a class period
- `GET /dashboard/classes` - Lists all class periods for a school
- `GET /dashboard/classes/[id]` - Shows detailed view of a specific class period
- `GET /dashboard/classes/create` - Form to create new class periods

## Features Implemented
- ✅ Hierarchical subject → class → period structure
- ✅ Dropdown selection with "Add New" options
- ✅ Real-time filtering of classes based on selected subject
- ✅ Flexible period naming (supports "1", "2A", "3B", "Morning", etc.)
- ✅ Role-based permissions (school_admin, district_admin)
- ✅ Comprehensive validation and error handling
- ✅ Clean, responsive UI with proper loading states
- ✅ Teacher assignment system with search and modal interface
- ✅ Class detail pages with comprehensive management features
- ✅ Real-time updates and live data synchronization

## Setup Instructions

### IMPORTANT: Database Setup Required
The teacher assignment functionality requires the database tables to be created first. Follow these steps:

### Step 1: Create Tables (in order)
Execute these SQL commands in your Supabase SQL editor:

```sql
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
```

### Step 2: Enable Row Level Security
```sql
-- Enable RLS on all tables
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teacher_assignments ENABLE ROW LEVEL SECURITY;
```

### Step 3: Create RLS Policies
```sql
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
```

### Step 4: Create Performance Indexes
```sql
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
```

### Step 5: Test the Functionality
After creating the database schema:
1. Navigate to `/dashboard/classes/create` to create your first class
2. Go to `/dashboard/classes` to view all classes
3. Click "View Details" on any class to access the teacher assignment feature
4. Click "Assign Teachers" to test the modal functionality

## Troubleshooting
- **Error: "relation does not exist"** - You need to create the database tables first
- **Error: "permission denied"** - Check that RLS policies are properly set up
- **No teachers showing** - Ensure you have teacher users in your school
- **Assignment fails** - Check that the user has school_admin or district_admin role

The frontend code is complete and ready to use once the database schema is in place.
