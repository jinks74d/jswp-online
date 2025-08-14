# District Branding Migration Instructions

## Problem
The Create New District form is failing because the `primary_color` and `secondary_color` columns don't exist in the districts table.

**Error:** "Could not find the 'primary_color' column of 'districts' in the schema cache"

## Solution
You need to execute the district branding migration to add the missing columns.

## STEP 1: Access Supabase Dashboard
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Navigate to your project: `zyivphqxqmbslxcrzbnh`
3. Click on "SQL Editor" in the left sidebar

## STEP 2: Execute Migration SQL
Copy and paste the following SQL into the SQL Editor and click "Run":

```sql
-- Add missing branding columns to districts table
ALTER TABLE districts ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7);

-- Add validation constraints for color format (hex colors)
ALTER TABLE districts ADD CONSTRAINT IF NOT EXISTS check_primary_color_format 
  CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE districts ADD CONSTRAINT IF NOT EXISTS check_secondary_color_format 
  CHECK (secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$');

-- Add constraint for logo URL format
ALTER TABLE districts ADD CONSTRAINT IF NOT EXISTS check_logo_url_format 
  CHECK (logo_url IS NULL OR logo_url ~ '^https?://.*');
```

## STEP 3: Verify Migration
After executing the SQL, run this verification query:

```sql
-- Test that the new columns exist and are accessible
SELECT 
  id, 
  name, 
  primary_color, 
  secondary_color, 
  logo_url,
  created_at
FROM districts 
LIMIT 5;
```

If the query executes without errors, the migration was successful!

## STEP 4: Test the Application
1. Go back to your application
2. Try to create a new district using the Create New District form
3. The form should now work without the column errors

## What These Columns Do
- **primary_color**: Stores the district's primary brand color as a hex code (e.g., "#3B82F6")
- **secondary_color**: Stores the district's secondary brand color as a hex code (e.g., "#64748B")  
- **logo_url**: Stores the URL to the district's logo image

## Optional: Storage Setup
If you want to enable logo uploads, you can also run the storage setup script:
`scripts/execute-district-logos-setup.sql`

## Files Involved
- Migration: `migrations/add-district-branding-features.sql`
- Verification: `scripts/verify-district-branding-schema.js`
- Types: `lib/database.types.ts` (already updated)

---

**Note:** The TypeScript types are already updated to include these columns, so once the database migration is complete, everything should work seamlessly.