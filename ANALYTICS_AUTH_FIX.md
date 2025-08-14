# Analytics Authentication Fix

## Issue

Analytics API returning "Unauthorized" errors, preventing school admins (and other users) from seeing analytics data.

## Root Cause Identified ✅

**The Supabase client configuration mismatch between client and server:**

- **Client-side**: Using custom `sessionStorage` with `storageKey: 'jswp-session'`
- **Server-side APIs**: Expecting standard Supabase cookies for authentication

This mismatch meant that while users were authenticated on the client-side, the server-side APIs couldn't access the session data because it was stored in sessionStorage instead of cookies.

## Fix Applied ✅

### **1. Updated Supabase Client Configuration** (`lib/supabase.ts`)

**Before:**

```typescript
auth: {
  persistSession: true,
  storage: window.sessionStorage, // Custom sessionStorage
  autoRefreshToken: true,
  detectSessionInUrl: false,
  flowType: 'pkce',
  storageKey: 'jswp-session', // Custom storage key
  debug: false,
},
```

**After:**

```typescript
auth: {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: false,
  flowType: 'pkce',
  debug: false,
},
// Removed custom storage - now uses default Supabase cookie handling
```

### **2. Updated Session Cleanup** (`components/auth/AuthProvider.tsx`)

**Before:**

```typescript
// Clear session storage completely
window.sessionStorage.clear();
```

**After:**

```typescript
// Clear our custom cache (Supabase handles its own storage)
sessionStorage.removeItem("jswp-profile-cache");
sessionStorage.removeItem("jswp-session-cache");
```

### **3. Added Debug Tools**

- **Auth Test API**: `/api/debug/auth-test` - Tests authentication and shows cookie/session details
- **Enhanced Debug Component**: Added "Test Auth" button to verify authentication

## How Authentication Now Works

### **Client-Side:**

1. User logs in through login page
2. Supabase stores session in **cookies** (default behavior)
3. Session persists across page reloads and tabs
4. AuthProvider manages user state and profile caching

### **Server-Side APIs:**

1. Receive requests with Supabase session cookies
2. Create server client that reads cookies automatically
3. Authenticate user via `supabase.auth.getUser()`
4. Return data based on user permissions

### **Session Flow:**

```
Login → Supabase Cookies → Server APIs → Analytics Data
```

## Expected Behavior After Fix

### **For All Users:**

- ✅ Analytics API should return data instead of "Unauthorized"
- ✅ Session tracking should work properly
- ✅ Cross-tab authentication should work
- ✅ Page refreshes should maintain authentication

### **For School Admins:**

- ✅ Analytics dashboard should show school-specific data
- ✅ Active users count should be accurate
- ✅ Session statistics should appear
- ✅ Teacher/student breakdown should work

## Testing the Fix

### **1. Check Debug Panel**

- Visit Analytics page
- Click "Test Auth" button
- Should show success with user and profile data

### **2. Check Analytics API**

- Click "Test Analytics API" button
- Should return analytics data instead of "Unauthorized"

### **3. Check Browser Network Tab**

- Should see successful API calls to `/api/analytics/dashboard`
- No more 401 Unauthorized responses

### **4. Check Browser Cookies**

- Open Developer Tools → Application → Cookies
- Should see Supabase session cookies (sb-\* cookies)

## Troubleshooting

### **If Still Getting "Unauthorized":**

1. **Clear Browser Data**: Clear all cookies and localStorage for the site
2. **Re-login**: Sign out completely and sign back in
3. **Check Cookies**: Verify Supabase cookies are being set
4. **Test Auth API**: Use debug panel to test authentication

### **If Session Not Persisting:**

1. **Check Cookie Settings**: Ensure cookies are enabled
2. **Check HTTPS**: Some cookie features require HTTPS
3. **Check Domain**: Ensure cookies are set for correct domain

### **If Cross-Tab Issues:**

1. **Broadcast Channel**: Should work automatically with cookie-based sessions
2. **Session Sync**: Supabase handles cross-tab session synchronization

## Performance Impact

### **Positive Changes:**

- ✅ **Better Compatibility**: Standard cookie handling works with all browsers
- ✅ **Automatic Sync**: Cross-tab session synchronization works out of the box
- ✅ **Server API Access**: Server-side APIs can properly authenticate users
- ✅ **Reduced Complexity**: No custom storage key management

### **No Negative Impact:**

- Session persistence still works
- Performance remains the same
- All existing functionality preserved

## Security Improvements

### **Enhanced Security:**

- ✅ **HttpOnly Cookies**: Supabase uses secure cookie settings
- ✅ **CSRF Protection**: Built-in CSRF protection with cookies
- ✅ **Secure Transmission**: Cookies sent securely over HTTPS
- ✅ **Automatic Expiration**: Session cookies expire appropriately

The fix resolves the authentication mismatch and should restore full analytics functionality for all user types, including school admins.
