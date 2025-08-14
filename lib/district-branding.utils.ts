import {
  DistrictWithBranding,
  DistrictBranding,
  DistrictColorTheme,
  DistrictBrandingUpdate,
  BrandingValidationResult,
  BrandingValidationError,
  DISTRICT_BRANDING_CONFIG,
  DISTRICT_LOGO_NAMING,
  isValidHexColor,
  isAllowedLogoFileType,
  isValidLogoFileSize
} from './district-branding.types'

// =====================================================
// COLOR UTILITIES
// =====================================================

/**
 * Convert hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

/**
 * Calculate luminance of a color (for contrast calculations)
 */
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)
  
  if (!rgb1 || !rgb2) return 0
  
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b)
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b)
  
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  
  return (brightest + 0.05) / (darkest + 0.05)
}

/**
 * Get the best contrast color (black or white) for a given background color
 */
export function getContrastColor(backgroundColor: string): string {
  const whiteContrast = getContrastRatio(backgroundColor, '#FFFFFF')
  const blackContrast = getContrastRatio(backgroundColor, '#000000')
  
  return whiteContrast > blackContrast ? '#FFFFFF' : '#000000'
}

/**
 * Create a complete color theme from district branding
 */
export function createColorTheme(district: DistrictBranding): DistrictColorTheme {
  const primary = district.primary_color || DISTRICT_BRANDING_CONFIG.colors.defaultPrimary
  const secondary = district.secondary_color || DISTRICT_BRANDING_CONFIG.colors.defaultSecondary
  
  const primaryRgb = hexToRgb(primary) || { r: 59, g: 130, b: 246 }
  const secondaryRgb = hexToRgb(secondary) || { r: 100, g: 116, b: 139 }
  
  return {
    primary,
    secondary,
    primaryRgb,
    secondaryRgb,
    primaryContrast: getContrastColor(primary),
    secondaryContrast: getContrastColor(secondary)
  }
}

// =====================================================
// FILE PATH UTILITIES
// =====================================================

/**
 * Generate the storage path for a district logo
 */
export function generateDistrictLogoPath(districtId: string, fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || 'png'
  return DISTRICT_LOGO_NAMING.fullPath(districtId, extension)
}

/**
 * Generate the full public URL for a district logo
 */
export function generateDistrictLogoUrl(
  supabaseUrl: string, 
  districtId: string, 
  fileName: string
): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || 'png'
  return DISTRICT_LOGO_NAMING.urlPattern(supabaseUrl, districtId, extension)
}

/**
 * Extract district ID from a logo file path
 */
export function extractDistrictIdFromPath(filePath: string): string | null {
  const match = filePath.match(/^district-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//)
  return match ? match[1] : null
}

/**
 * Validate file for district logo upload
 */
export function validateLogoFile(file: File): BrandingValidationResult {
  const errors: BrandingValidationError[] = []
  const warnings: string[] = []

  // Check file size
  if (!isValidLogoFileSize(file.size)) {
    errors.push({
      field: 'logo_url',
      message: `File size must be less than ${DISTRICT_BRANDING_CONFIG.logo.maxSize / 1024 / 1024}MB`,
      code: 'FILE_TOO_LARGE'
    })
  }

  // Check file type
  if (!isAllowedLogoFileType(file.type)) {
    errors.push({
      field: 'logo_url',
      message: `File type ${file.type} is not allowed. Allowed types: ${DISTRICT_BRANDING_CONFIG.logo.allowedTypes.join(', ')}`,
      code: 'INVALID_FILE_TYPE'
    })
  }

  // Check dimensions (if possible)
  if (file.type.startsWith('image/') && file.size > 2 * 1024 * 1024) {
    warnings.push('Large image files may affect page load performance. Consider optimizing the image.')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// =====================================================
// VALIDATION UTILITIES
// =====================================================

/**
 * Validate district branding data
 */
export function validateDistrictBranding(data: DistrictBrandingUpdate): BrandingValidationResult {
  const errors: BrandingValidationError[] = []
  const warnings: string[] = []

  // Validate primary color
  if (data.primary_color !== undefined && data.primary_color !== null) {
    if (!isValidHexColor(data.primary_color)) {
      errors.push({
        field: 'primary_color',
        message: 'Primary color must be a valid hex color (e.g., #FF0000)',
        code: 'INVALID_HEX_COLOR'
      })
    }
  }

  // Validate secondary color
  if (data.secondary_color !== undefined && data.secondary_color !== null) {
    if (!isValidHexColor(data.secondary_color)) {
      errors.push({
        field: 'secondary_color',
        message: 'Secondary color must be a valid hex color (e.g., #00FF00)',
        code: 'INVALID_HEX_COLOR'
      })
    }
  }

  // Check color contrast if both colors are provided
  if (data.primary_color && data.secondary_color) {
    const contrast = getContrastRatio(data.primary_color, data.secondary_color)
    if (contrast < 3) {
      warnings.push('Low contrast between primary and secondary colors may affect accessibility.')
    }
  }

  // Validate logo URL format
  if (data.logo_url !== undefined && data.logo_url !== null) {
    try {
      new URL(data.logo_url)
    } catch {
      errors.push({
        field: 'logo_url',
        message: 'Logo URL must be a valid HTTP/HTTPS URL',
        code: 'INVALID_URL_FORMAT'
      })
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// =====================================================
// BRANDING UTILITIES
// =====================================================

/**
 * Extract branding data from a district record
 */
export function extractBrandingData(district: DistrictWithBranding): DistrictBranding {
  return {
    id: district.id,
    name: district.name,
    logo_url: district.logo_url,
    primary_color: district.primary_color,
    secondary_color: district.secondary_color
  }
}

/**
 * Check if district has any branding configured
 */
export function hasBranding(district: DistrictBranding): boolean {
  return !!(district.logo_url || district.primary_color || district.secondary_color)
}

/**
 * Get fallback branding for districts without custom branding
 */
export function getFallbackBranding(districtName: string): DistrictBranding {
  return {
    id: '',
    name: districtName,
    logo_url: null,
    primary_color: DISTRICT_BRANDING_CONFIG.colors.fallbackPrimary,
    secondary_color: DISTRICT_BRANDING_CONFIG.colors.fallbackSecondary
  }
}

/**
 * Merge district data with fallback branding
 */
export function mergeWithFallback(district: DistrictBranding): DistrictBranding {
  return {
    ...district,
    primary_color: district.primary_color || DISTRICT_BRANDING_CONFIG.colors.fallbackPrimary,
    secondary_color: district.secondary_color || DISTRICT_BRANDING_CONFIG.colors.fallbackSecondary
  }
}

// =====================================================
// CSS UTILITIES
// =====================================================

/**
 * Generate CSS custom properties for district branding
 */
export function generateBrandingCssVars(branding: DistrictBranding): Record<string, string> {
  const theme = createColorTheme(branding)
  
  return {
    '--district-primary': theme.primary,
    '--district-secondary': theme.secondary,
    '--district-primary-rgb': `${theme.primaryRgb.r}, ${theme.primaryRgb.g}, ${theme.primaryRgb.b}`,
    '--district-secondary-rgb': `${theme.secondaryRgb.r}, ${theme.secondaryRgb.g}, ${theme.secondaryRgb.b}`,
    '--district-primary-contrast': theme.primaryContrast,
    '--district-secondary-contrast': theme.secondaryContrast
  }
}

/**
 * Generate CSS string for district branding
 */
export function generateBrandingCss(branding: DistrictBranding): string {
  const vars = generateBrandingCssVars(branding)
  return Object.entries(vars)
    .map(([key, value]) => `${key}: ${value};`)
    .join(' ')
}

// =====================================================
// EXPORT UTILITIES
// =====================================================

export {
  DISTRICT_BRANDING_CONFIG,
  DISTRICT_LOGO_NAMING
} from './district-branding.types'