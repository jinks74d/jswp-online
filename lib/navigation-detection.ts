// lib/navigation-detection.ts
'use client';

/**
 * Utility for detecting different types of navigation events
 * to help distinguish between internal navigation and actual page unloads
 */

let isNavigating = false;
let navigationStartTime = 0;
let lastClickTime = 0;

// Set up global navigation detection
if (typeof window !== 'undefined') {
  // Track router navigation (Next.js App Router)
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;
  
  window.history.pushState = function(...args) {
    markNavigation();
    return originalPushState.apply(window.history, args);
  };
  
  window.history.replaceState = function(...args) {
    markNavigation();
    return originalReplaceState.apply(window.history, args);
  };
  
  // Listen for popstate (back/forward navigation)
  window.addEventListener('popstate', markNavigation);
  
  // Listen for link clicks
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    
    if (link) {
      lastClickTime = Date.now();
      // If it's an internal link, mark as navigation
      if (link.href.startsWith(window.location.origin) || link.href.startsWith('/')) {
        markNavigation();
      }
    }
  }, { capture: true });
  
  // Listen for form submissions that might cause navigation
  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    if (form.method === 'get' || !form.action || form.action.startsWith(window.location.origin)) {
      markNavigation();
    }
  }, { capture: true });
}

function markNavigation() {
  isNavigating = true;
  navigationStartTime = Date.now();
  
  // Reset navigation flag after a delay
  setTimeout(() => {
    isNavigating = false;
    navigationStartTime = 0;
  }, 1000);
}

/**
 * Determines if the current context appears to be a real page unload
 * vs internal navigation
 */
export function isLikelyRealPageUnload(): boolean {
  const now = Date.now();
  
  // If we're currently navigating, this is likely not a real unload
  if (isNavigating) {
    return false;
  }
  
  // If navigation started very recently, this might be navigation
  const timeSinceNavigation = now - navigationStartTime;
  if (timeSinceNavigation < 1000 && navigationStartTime > 0) {
    return false;
  }
  
  // If there was a recent click that might have triggered navigation
  const timeSinceClick = now - lastClickTime;
  if (timeSinceClick < 1000 && lastClickTime > 0) {
    return false;
  }
  
  // Check if we're in a Next.js navigation context
  if (typeof window !== 'undefined') {
    // Check for Next.js router state indicators
    const nextRouter = (window as any).__NEXT_ROUTER__;
    if (nextRouter && nextRouter.isFallback) {
      return false;
    }
    
    // Check for active fetch requests (might indicate navigation)
    if ((window as any).__NEXT_DATA__?.props?.pageProps?.dehydratedState) {
      return false;
    }
  }
  
  return true;
}

/**
 * Registers a callback to be called when navigation starts
 */
export function onNavigationStart(callback: () => void): () => void {
  const wrappedCallback = () => {
    markNavigation();
    callback();
  };
  
  // Add to existing listeners
  window.addEventListener('popstate', wrappedCallback);
  
  return () => {
    window.removeEventListener('popstate', wrappedCallback);
  };
}

/**
 * Current navigation state
 */
export function getNavigationState() {
  return {
    isNavigating,
    navigationStartTime,
    lastClickTime,
  };
}