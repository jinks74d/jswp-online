// Test script to check session persistence
// Run this in browser console after logging in to verify session data is stored correctly

console.log('=== Session Persistence Test ===');

// Check localStorage for Supabase auth tokens
const storageKeys = Object.keys(localStorage);
const supabaseKeys = storageKeys.filter(key => 
  key.startsWith('sb-') || key.includes('supabase') || key.includes('auth')
);

console.log('Found auth-related storage keys:', supabaseKeys);

supabaseKeys.forEach(key => {
  const value = localStorage.getItem(key);
  try {
    const parsed = JSON.parse(value);
    console.log(`${key}:`, parsed);
  } catch (e) {
    console.log(`${key}:`, value);
  }
});

// Check for session cookies
console.log('Document cookies:', document.cookie);

// Check if Supabase client has a session
if (window.supabase) {
  window.supabase.auth.getSession().then(({ data: { session }, error }) => {
    console.log('Current session:', session);
    console.log('Session error:', error);
  });
} else {
  console.log('Supabase client not available on window object');
}

console.log('=== End Session Test ===');