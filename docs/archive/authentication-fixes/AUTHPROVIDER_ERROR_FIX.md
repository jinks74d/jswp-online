# AuthProvider Error Fix

## Problem

Error in AuthProvider component:

```
Error at captureStackTrace (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/capture-stack-trace.js:13:23)
at console.error (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/globals/intercept-console-error.js:51:62)
at AuthProvider.useEffect.checkInitialSession (webpack-internal:///(app-pages-browser)/./components/auth/AuthProvider.tsx:291:33)
```

## Root Cause

The `handleNetworkError` function was being called in a `useEffect` before it was defined. In JavaScript:

- Function declarations are hoisted (can be called before definition)
- `const` function expressions are NOT hoisted (must be defined before use)

## Issue Details

```typescript
// This useEffect was calling handleNetworkError()
useEffect(() => {
  // ... code that calls handleNetworkError()
}, []);

// But handleNetworkError was defined AFTER the useEffect
const handleNetworkError = useCallback(() => {
  // function body
}, []);
```

## Solution Applied

1. **Moved `handleNetworkError` function** before the `useEffect` that calls it
2. **Removed duplicate function definition** that was causing confusion
3. **Maintained proper function dependencies** in useCallback

## Fixed Code Structure

```typescript
// 1. Other functions and effects...

// 2. Define handleNetworkError BEFORE it's used
const handleNetworkError = useCallback(() => {
  console.log(
    "AuthProvider: Handling network error with 5-minute grace period"
  );
  setNetworkError(true);
  // ... rest of function
}, []);

// 3. Initialize authentication useEffect (calls handleNetworkError)
useEffect(() => {
  // ... code that can now safely call handleNetworkError()
}, [supabase, handleAuthChange]);

// 4. Other functions...
```

## Result

- ✅ No more console errors in AuthProvider
- ✅ Network error handling works properly
- ✅ Function hoisting issue resolved
- ✅ Clean code structure maintained

The AuthProvider should now work without errors and properly handle network issues during authentication.
