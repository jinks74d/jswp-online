# Analytics Troubleshooting Guide

## Issue: Analytics Not Showing

The analytics dashboard is showing "No analytics data available" even though the system appears to be set up correctly.

## Root Cause Identified ✅

**The SessionTrackingProvider was imported but not being used in the dashboard layouts.**

## Fix Applied ✅

### 1. **Server-Side Dashboard Layout** (`app/dashboard/layout.tsx`)

**Before:**

```tsx
return (
  <div className="min-h-screen" style={gradientStyle}>
    <DashboardSidebar profile={profile} />
    <div className="pl-64">
      <main className="py-8 px-8">{children}</main>
    </div>
  </div>
);
```

**After:**

```tsx
return (
  <SessionTrackingProvider>
    <div className="min-h-screen" style={gradientStyle}>
      <DashboardSidebar profile={profile} />
      <div className="pl-64">
        <main className="py-8 px-8">{children}</main>
      </div>
    </div>
  </SessionTrackingProvider>
);
```

### 2. **Client-Side Dashboard** (`components/dashboard/ClientDashboard.tsx`)

**Before:**

```tsx
return (
  <div className="min-h-screen" style={gradientStyle}>
    <DashboardSidebar profile={profile as any} />
    <div className="pl-64">
      <main className="py-8 px-8">{children}</main>
    </div>
  </div>
);
```

**After:**

```tsx
return (
  <SessionTrackingProvider>
    <div className="min-h-screen" style={gradientStyle}>
      <DashboardSidebar profile={profile as any} />
      <div className="pl-64">
        <main className="py-8 px-8">{children}</main>
      </div>
    </div>
  </SessionTrackingProvider>
);
```

## How Session Tracking Works

### **Automatic Session Management:**

1. **Session Start**: When user enters dashboard, `useSessionTracking` hook calls `/api/analytics/session/start`
2. **Activity Updates**: Every 30 seconds, calls `/api/analytics/session/activity` to update `last_activity`
3. **Page Views**: Tracks page navigation and time spent on each page
4. **Session End**: When user leaves or becomes idle (15 minutes), calls `/api/analytics/session/end`

### **Data Storage:**

- **user_sessions**: Main session data (start, end, duration, device info)
- **user_page_views**: Page-by-page navigation tracking
- **user_actions**: Specific user actions (form submissions, clicks, etc.)

### **Analytics Dashboard:**

- Queries `user_sessions` table for analytics data
- Aggregates by role, device, school, district
- Shows real-time active users, session durations, usage patterns

## Verification Steps

### **1. Check Session Creation**

After logging in to dashboard, check browser Network tab:

- Should see POST to `/api/analytics/session/start`
- Should return `{ sessionId: "...", success: true }`

### **2. Check Activity Updates**

Every 30 seconds while on dashboard:

- Should see POST to `/api/analytics/session/activity`
- Updates `last_activity` timestamp

### **3. Check Database**

Query the `user_sessions` table:

```sql
SELECT * FROM user_sessions
WHERE user_id = 'your-user-id'
ORDER BY session_start DESC
LIMIT 5;
```

### **4. Check Analytics API**

Visit `/api/analytics/dashboard?range=7d` directly:

- Should return analytics data JSON
- Check for `summary`, `breakdown`, `daily` data

## Expected Behavior After Fix

### **Immediate (After Login):**

- Session tracking starts automatically
- Network requests to session APIs
- `user_sessions` table gets new records

### **After 30 seconds:**

- Regular activity updates
- `last_activity` field updates in database

### **After Using Dashboard:**

- Page views tracked
- Session duration calculated
- Analytics data available in dashboard

### **Analytics Dashboard:**

- Shows current active users
- Displays session statistics
- Shows usage by role, device, time

## Database Schema Required

The analytics system requires these tables (should already exist):

```sql
-- Main session tracking
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  district_id UUID REFERENCES districts(id),
  school_id UUID REFERENCES schools(id),
  session_start TIMESTAMP WITH TIME ZONE,
  session_end TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  pages_visited INTEGER DEFAULT 0,
  actions_count INTEGER DEFAULT 0,
  device_type VARCHAR(20),
  ip_address INET,
  user_agent TEXT,
  browser_info JSONB,
  is_active BOOLEAN DEFAULT true
);

-- Page view tracking
CREATE TABLE user_page_views (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES user_sessions(id),
  user_id UUID REFERENCES user_profiles(id),
  district_id UUID REFERENCES districts(id),
  school_id UUID REFERENCES schools(id),
  page_path VARCHAR(500),
  page_title VARCHAR(500),
  time_on_page_seconds INTEGER,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Action tracking
CREATE TABLE user_actions (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES user_sessions(id),
  user_id UUID REFERENCES user_profiles(id),
  district_id UUID REFERENCES districts(id),
  school_id UUID REFERENCES schools(id),
  action_type VARCHAR(100),
  action_details JSONB,
  assignment_id UUID,
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Testing the Fix

### **1. Login to Dashboard**

- Should see session start in Network tab
- Check browser console for any errors

### **2. Wait 30 seconds**

- Should see activity update requests
- No errors in console

### **3. Navigate Between Pages**

- Each page change should be tracked
- Session remains active

### **4. Visit Analytics Dashboard**

- Should show data instead of "No analytics data available"
- Active users count should be > 0
- Session statistics should appear

### **5. Check Database**

```sql
-- Check recent sessions
SELECT
  us.id,
  us.session_start,
  us.last_activity,
  us.is_active,
  us.device_type,
  up.email,
  up.role
FROM user_sessions us
JOIN user_profiles up ON us.user_id = up.id
WHERE us.session_start > NOW() - INTERVAL '1 day'
ORDER BY us.session_start DESC;
```

## Common Issues

### **1. "No analytics data available"**

- ✅ **Fixed**: SessionTrackingProvider now properly wrapped around dashboard
- Verify session tracking is starting (check Network tab)

### **2. Sessions not being created**

- Check user authentication (must be logged in)
- Verify API endpoints are accessible
- Check database permissions (RLS policies)

### **3. Analytics showing 0 active users**

- Sessions might be ending too quickly
- Check idle timeout settings (default 15 minutes)
- Verify `is_active` field is being set correctly

### **4. Database permission errors**

- Check RLS policies on analytics tables
- Ensure user has proper district/school associations
- Verify API authentication is working

The fix should resolve the analytics not showing issue. Users should now see session tracking data in the analytics dashboard after using the system for a few minutes.
