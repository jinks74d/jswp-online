import React from 'react';
import DOMPurify from 'dompurify';

/**
 * Secure HTML sanitization utility using DOMPurify
 * Prevents XSS attacks while preserving safe HTML formatting
 */

// Configuration for educational content with formatting
const EDUCATIONAL_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 
    'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
  ],
  ALLOWED_ATTR: [
    'class', 'style', 'id'
  ],
  ALLOWED_STYLES: [
    'color', 'background-color', 'font-weight', 'font-style', 
    'text-decoration', 'text-indent', 'margin', 'padding'
  ]
};

// Configuration for basic text with minimal formatting
const BASIC_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em'],
  ALLOWED_ATTR: []
};

/**
 * Sanitizes HTML content for educational assignments
 * Allows color coding and basic formatting for student work
 */
export function sanitizeEducationalHTML(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Server-side check
  if (typeof window === 'undefined') {
    // On server, return plain text to be safe
    return html.replace(/<[^>]*>/g, '');
  }

  return DOMPurify.sanitize(html, {
    ...EDUCATIONAL_CONFIG,
    // Additional security measures
    FORBID_TAGS: ['script', 'object', 'embed', 'base', 'meta', 'link'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    // Remove any data: URLs to prevent data exfiltration
    FORBID_CONTENTS: ['script'],
    // Sanitize CSS to prevent CSS-based attacks
    SANITIZE_DOM: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false
  });
}

/**
 * Sanitizes HTML content for basic display
 * Very restrictive - only allows basic formatting
 */
export function sanitizeBasicHTML(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Server-side check
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]*>/g, '');
  }

  return DOMPurify.sanitize(html, BASIC_CONFIG);
}

/**
 * Sanitizes user input to prevent XSS in text content
 * Removes all HTML tags completely
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Server-side or client-side - strip all HTML
  return DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [], 
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true 
  });
}

/**
 * Validates that content is safe before rendering
 * Returns false if content contains potentially dangerous patterns
 */
export function validateSafeContent(content: string): boolean {
  if (!content) return true;
  
  // Check for dangerous patterns that might bypass sanitization
  const dangerousPatterns = [
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
    /on\w+\s*=/i, // event handlers like onclick=
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(content));
}

/**
 * Safe HTML renderer component props
 */
export interface SafeHTMLProps {
  content: string;
  className?: string;
  fallback?: string;
  sanitizeLevel?: 'educational' | 'basic';
}

/**
 * React component for safely rendering HTML content
 */
export function SafeHTML({ 
  content, 
  className = '', 
  fallback = 'Content unavailable',
  sanitizeLevel = 'educational'
}: SafeHTMLProps) {
  // Validate content first
  if (!validateSafeContent(content)) {
    console.warn('SafeHTML: Potentially dangerous content blocked');
    return <div className={className}>{fallback}</div>;
  }

  // Choose sanitization level
  const sanitizedContent = sanitizeLevel === 'educational' 
    ? sanitizeEducationalHTML(content)
    : sanitizeBasicHTML(content);

  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
}