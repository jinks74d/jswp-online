# Authentication & Session Management Documentation

## ⚠️ CRITICAL RULE
**NEVER make changes or suggest changes to authentication and session management unless explicitly requested by the user. Complete any requested tasks first, then offer suggestions afterward if appropriate.**

## Current Authentication System Overview

### Core Components

1. **Supabase Authentication**
   - Located in: `/lib/supabase.ts`
   - Uses Supabase Auth for user authentication
   - Session management handled by Supabase client
   - JWT tokens stored in cookies

2. **Auth Provider**
   - Located in: `/components/auth/OptimizedAuthProvider.tsx`
   - Provides auth context throughout the application
   - Manages user state and profile data
   - Handles auth state changes and session refresh

3. **Auth Cache**
   - Located in: `/lib/auth-cache.ts`
   - Caches authentication state for performance
   - Reduces unnecessary database queries
   - Manages session validity checks

4. **Redirect Handler**
   - Located in: `/lib/redirect-handler.ts`
   - Manages role-based redirects
   - Handles post-login navigation
   - Prevents redirect loops

### User Roles & Access Levels

1. **super_admin**
   - Full system access
   - Can manage districts and schools
   - Access to `/super-admin/*` routes

2. **district_admin**
   - District-level management
   - Can manage schools within their district
   - Access to district dashboard

3. **school_admin**
   - School-level management
   - Can manage teachers and students
   - Access to school dashboard

4. **teacher**
   - Can create and manage assignments
   - View student progress
   - Access to teacher dashboard

5. **student**
   - Can access assignments
   - Submit work
   - View their own progress

### Authentication Flow

1. **Login Process** (`/app/page.tsx`)
   - User enters credentials
   - Supabase validates credentials
   - Session created and stored
   - User redirected based on role
   - Auth cache updated

2. **Session Management**
   - Sessions persist across page refreshes
   - Automatic token refresh before expiry
   - Session validation on protected routes
   - Logout clears all session data

3. **Protected Routes**
   - Middleware checks authentication status
   - Role-based access control
   - Redirects unauthenticated users to login
   - Prevents unauthorized access

### Key Files

- `/app/page.tsx` - Main login page
- `/app/admin/page.tsx` - Admin login page
- `/lib/supabase.ts` - Supabase client configuration
- `/components/auth/OptimizedAuthProvider.tsx` - Auth context provider
- `/lib/auth-cache.ts` - Authentication caching logic
- `/lib/redirect-handler.ts` - Redirect management
- `/middleware.ts` - Route protection and auth checks

### Database Tables

- `user_profiles` - Stores user profile information and roles
- `districts` - District information
- `schools` - School information
- `assignments` - Assignment data
- `student_submissions` - Student work submissions

### Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only)

### Current Issues & Debug Features

The login page currently includes debug buttons for testing:
- Test Session & Profile button
- Manual Dashboard navigation
- Sign Out button

These are marked with comments "remove in production" and are for development testing.

### Security Considerations

1. **JWT Tokens**
   - Stored securely in httpOnly cookies
   - Automatic refresh before expiry
   - Cleared on logout

2. **Row Level Security (RLS)**
   - Database-level access control
   - Policies based on user roles
   - Prevents unauthorized data access

3. **API Routes**
   - Server-side validation
   - Role checking before operations
   - Secure session verification

## Important Notes

1. The authentication system is tightly integrated with Supabase
2. Changes to auth flow can break multiple components
3. Session management affects the entire application
4. Role-based access is enforced at multiple levels
5. The auth cache improves performance but must stay synchronized

## Reminder

**Always complete the user's requested task first before suggesting any auth-related improvements. The authentication system is complex and working - avoid modifying it unless specifically requested.**