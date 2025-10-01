# School Analytics Fix

## Issue

School admin users are not seeing analytics data in the Analytics dashboard, even though the system appears to be set up correctly.

## Root Causes Identified & Fixed

### 1. **Frontend Level Parameter Issue** ✅ **FIXED**

**Problem**: The analytics dashboard was defaulting to `level: "auto"` for all users, but the frontend logic only passed `school_id` parameter when `level === "school"`. This meant school admins weren't getting their school_id passed to the API.

**Fix Applied**:

```typescript
// Before: Always defaulted to "auto"
const [level, setLevel] = useState("auto");

// After: Set appropriate default based on user role
const [level, setLevel] = useState(() => {
  if (userRole === "school_admin") return "school";
  if (userRole === "district_admin") return "district";
  return "auto";
});
```

### 2. **Parameter Passing Logic** ✅ **FIXED**

**Problem**: The frontend only passed `school_id` when `level === "school"`, but school admins need their school_id passed regardless of level.

**Fix Applied**:

```typescript
// Before: Only passed school_id for specific level
if (level === "school" && schoolId) {
  params.append("school_id", schoolId);
}

// After: Always pass school_id for school admins
if (
  (userRole === "school_admin" && schoolId) ||
  (level === "school" && schoolId)
) {
  params.append("school_id", schoolId);
}
```

### 3. **Added Debug Tools** ✅ **ADDED**

Created debugging components to help diagnose analytics issues:

- **Debug API Endpoint**: `/api/debug/analytics-school` - Shows session counts, errors, sample data
- **Debug Component**: `AnalyticsDebug` - Real-time debugging panel (development only)

## How to Test the Fix

### **1. Check Debug Panel (Development Only)**

- Visit the Analytics page as a school admin
- Look for the debug panel in the bottom-left corner
- Check the session counts and current status

### **2. Test Session Tracking**

- Click "Test Session Start" in debug panel
- Should show success message with session ID
- Check "Tracking: Active" status

### **3. Test Analytics API**

- Click "Test Analytics API" in debug panel
- Should show analytics data instead of error
- Check for non-zero session counts

### **4. Check Browser Network Tab**

- Visit Analytics page
- Look for request to `/api/analytics/dashboard?range=7d&level=school&district_id=...&school_id=...`
- Should include both district_id and school_id parameters

### **5. Verify Database Data**

You can also check the database directly:

```sql
-- Check if sessions are being created for your school
SELECT
  us.id,
  us.session_start,
  us.is_active,
  us.duration_minutes,
  up.email,
  up.role,
  s.name as school_name
FROM user_sessions us
JOIN user_profiles up ON us.user_id = up.id
LEFT JOIN schools s ON us.school_id = s.id
WHERE us.school_id = 'your-school-id'
ORDER BY us.session_start DESC
LIMIT 10;
```

## Expected Behavior After Fix

### **For School Admins:**

1. **Default Level**: Automatically set to "school" level
2. **API Requests**: Include both `district_id` and `school_id` parameters
3. **Analytics Data**: Show school-specific analytics including:
   - Active users in the school
   - Teacher vs student breakdown
   - Session statistics for the school
   - Usage patterns within the school

### **Analytics Dashboard Should Show:**

- **Active Users**: Current users active in your school
- **Session Stats**: Average session time for your school users
- **Role Breakdown**: Teachers vs students in your school
- **Device Types**: How users access the system
- **Daily Trends**: Usage patterns over time
- **Teacher/Student Summary**: Detailed breakdown by role

## Debugging Steps if Still Not Working

### **1. Check Session Creation**

- Use debug panel to test session start
- Check browser console for errors
- Verify user has proper school_id in profile

### **2. Check API Response**

- Use debug panel to test analytics API
- Look for error messages in response
- Verify school_id is being passed correctly

### **3. Check Database Permissions**

- Ensure RLS policies allow school admins to read their school's sessions
- Verify user_sessions table has proper data
- Check if school_id is being set correctly in sessions

### **4. Check Profile Data**

- Verify user profile has correct school_id
- Ensure school exists in schools table
- Check district_id is also set correctly

## Database Requirements

The analytics system requires these tables with proper RLS policies:

```sql
-- user_sessions table with school-level access
CREATE POLICY "School admins can view school sessions" ON user_sessions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.school_id = user_sessions.school_id
    AND user_profiles.role = 'school_admin'
  )
);
```

## Common Issues & Solutions

### **"No analytics data available"**

- ✅ **Fixed**: Level parameter and school_id passing
- Check if sessions are being created (debug panel)
- Verify user has school_id in profile

### **"0 active users" but users are logged in**

- Check if SessionTrackingProvider is wrapped around dashboard
- Verify session tracking is starting (debug panel)
- Check if sessions are marked as `is_active = true`

### **Analytics API returns empty data**

- Verify school_id parameter is being passed
- Check RLS policies on user_sessions table
- Ensure user has proper permissions

### **Debug panel shows errors**

- Check database connection
- Verify table structure matches expected schema
- Check for RLS policy issues

The fixes should resolve the school analytics issue. School admins should now see their school-specific analytics data including active users, session statistics, and usage breakdowns.
