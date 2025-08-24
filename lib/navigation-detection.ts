/**
 * Navigation detection utilities for session tracking
 */

export function isLikelyRealPageUnload(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check if the page is being refreshed or closed vs navigating
  return window.performance && window.performance.navigation.type === 1;
}

export function onNavigationStart(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  let isNavigating = false;
  
  const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
    if (!isNavigating) {
      callback();
      isNavigating = true;
    }
  };
  
  const visibilityChangeHandler = () => {
    if (document.visibilityState === 'hidden' && !isNavigating) {
      callback();
      isNavigating = true;
    }
  };
  
  const pagehideHandler = () => {
    if (!isNavigating) {
      callback();
      isNavigating = true;
    }
  };
  
  // Add event listeners
  window.addEventListener('beforeunload', beforeUnloadHandler);
  document.addEventListener('visibilitychange', visibilityChangeHandler);
  window.addEventListener('pagehide', pagehideHandler);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    document.removeEventListener('visibilitychange', visibilityChangeHandler);
    window.removeEventListener('pagehide', pagehideHandler);
  };
}