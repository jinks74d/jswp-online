# Database Migrations

This folder contains all database setup and migration scripts for the JSWP Online platform.

## Setup Order

Execute these scripts in the following order for a fresh database setup:

### 1. Core Schema
- `database-setup.sql` - Main database schema creation
- `create-analytics-schema.sql` - Analytics tables and functions

### 2. Table Structure Updates
- `create-student-assignment-progress-table.sql` - Student progress tracking
- `add-concrete-details-field.sql` - Concrete details field addition
- `add-prompt-field.sql` - Assignment prompt field
- `assignment-class-relationship.sql` - Assignment-class relationships

### 3. Security and Performance Fixes
- `fix-assignments-table.sql` - Assignment table corrections
- `fix-rls-auth-performance.sql` - Row Level Security optimizations
- `fix-get-user-district-id-security.sql` - User district function security
- `fix-get-user-role-security.sql` - User role function security  
- `fix-get-user-school-id-security.sql` - User school function security
- `fix-update-teacher-student-assignments-security.sql` - Teacher assignments security
- `fix-update-updated-at-column-security.sql` - Update timestamp security

### 4. Data Relationship Updates
- `missing-student-enrollments.sql` - Student enrollment fixes
- `missing-teacher-assignments.sql` - Teacher assignment fixes
- `safe-update-assignments-table.sql` - Safe assignment table updates
- `update-assignments-table.sql` - Assignment table updates

## Usage

1. **For Fresh Setup**: Execute scripts in the order listed above
2. **For Existing Databases**: Only run the scripts you need based on your current schema
3. **Always backup** your database before running migration scripts

## Important Notes

- All scripts include proper error handling and rollback procedures
- RLS (Row Level Security) policies are included for data protection
- Scripts are idempotent where possible (safe to run multiple times)
- Check the main `DATABASE_SCHEMA.md` file for detailed schema documentation

## Supabase Setup

These scripts are designed for Supabase PostgreSQL. Run them in the Supabase SQL Editor:

1. Go to your Supabase project
2. Navigate to SQL Editor
3. Execute scripts in order
4. Verify each script completes successfully before proceeding
