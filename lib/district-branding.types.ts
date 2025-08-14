import { Tables } from './database.types'

// =====================================================
// DISTRICT BRANDING TYPES
// =====================================================

/**
 * District with branding information
 */
export type DistrictWithBranding = Tables<'districts'>

/**
 * District branding data only (for public display)
 */
export interface DistrictBranding {
  id: string
  name: string
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
}

/**
 * District branding update payload
 */
export interface DistrictBrandingUpdate {
  logo_url?: string | null
  primary_color?: string | null
  secondary_color?: string | null
}

/**
 * Allowed MIME types for district logos
 */
export type LogoMimeType = 
  | 'image/jpeg'
  | 'image/jpg'
  | 'image/png'
  | 'image/webp'
  | 'image/svg+xml'

/**
 * File upload configuration for district logos
 */
export interface DistrictLogoUploadConfig {
  maxSize: number // in bytes
  allowedTypes: LogoMimeType[]
  bucket: string
  folder: string
}

/**
 * District logo file information
 */
export interface DistrictLogoFile {
  name: string
  path: string
  fullUrl: string
  size: number
  type: string
  lastModified: Date
}

/**
 * Color theme derived from district branding
 */
export interface DistrictColorTheme {
  primary: string
  secondary: string
  primaryRgb: { r: number; g: number; b: number }
  secondaryRgb: { r: number; g: number; b: number }
  primaryContrast: string // calculated contrast color (black/white)
  secondaryContrast: string // calculated contrast color (black/white)
}

// =====================================================
// CONSTANTS
// =====================================================

/**
 * Default district branding configuration
 */
export const DISTRICT_BRANDING_CONFIG = {
  logo: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/svg+xml'
    ] as const satisfies readonly LogoMimeType[],
    bucket: 'district-logos',
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'svg']
  },
  colors: {
    defaultPrimary: '#3B82F6', // Blue-500
    defaultSecondary: '#64748B', // Slate-500
    fallbackPrimary: '#1F2937', // Gray-800
    fallbackSecondary: '#6B7280' // Gray-500
  }
} as const

/**
 * File naming conventions for district logos
 */
export const DISTRICT_LOGO_NAMING = {
  folderPattern: (districtId: string) => `district-${districtId}`,
  filePattern: (extension: string) => `logo.${extension}`,
  fullPath: (districtId: string, extension: string) => 
    `district-${districtId}/logo.${extension}`,
  urlPattern: (supabaseUrl: string, districtId: string, extension: string) =>
    `${supabaseUrl}/storage/v1/object/public/district-logos/district-${districtId}/logo.${extension}`
} as const

// =====================================================
// TYPE GUARDS
// =====================================================

/**
 * Type guard to check if a district has complete branding
 */
export function hasCompleteBranding(district: DistrictWithBranding): boolean {
  return !!(
    district.logo_url &&
    district.primary_color &&
    district.secondary_color
  )
}

/**
 * Type guard to check if a color is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}

/**
 * Type guard to check if a file type is allowed for district logos
 */
export function isAllowedLogoFileType(mimeType: string): mimeType is LogoMimeType {
  return (DISTRICT_BRANDING_CONFIG.logo.allowedTypes as readonly string[]).includes(mimeType)
}

/**
 * Type guard to check if a file size is within limits
 */
export function isValidLogoFileSize(size: number): boolean {
  return size <= DISTRICT_BRANDING_CONFIG.logo.maxSize && size > 0
}

// =====================================================
// UTILITY TYPES FOR API RESPONSES
// =====================================================

/**
 * API response for district branding operations
 */
export interface DistrictBrandingResponse {
  success: boolean
  data?: DistrictBranding
  error?: string
  message?: string
}

/**
 * API response for file upload operations
 */
export interface FileUploadResponse {
  success: boolean
  data?: {
    path: string
    fullUrl: string
    publicUrl: string
  }
  error?: string
  message?: string
}

/**
 * Validation error for branding updates
 */
export interface BrandingValidationError {
  field: keyof DistrictBrandingUpdate
  message: string
  code: string
}

/**
 * Comprehensive validation result
 */
export interface BrandingValidationResult {
  isValid: boolean
  errors: BrandingValidationError[]
  warnings: string[]
}

// =====================================================
// EXPORT ALL TYPES
// =====================================================

export type {
  Tables // Re-export from database types for convenience
}