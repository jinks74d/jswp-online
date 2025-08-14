// lib/district-logo-utils.ts

/**
 * Generate the API URL for a district logo
 */
export function getDistrictLogoUrl(districtId: string): string {
  return `/api/districts/${districtId}/logo`;
}

/**
 * Generate the storage path for a district logo file
 */
export function getDistrictLogoStoragePath(districtId: string, extension: string = 'png'): string {
  return `district-${districtId}/logo.${extension}`;
}

/**
 * Get the file extension from a filename
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || 'png';
}

/**
 * Validate if a file type is allowed for district logos
 */
export function isValidLogoFileType(mimeType: string): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml'
  ];
  return allowedTypes.includes(mimeType);
}

/**
 * Validate if a file size is within limits (5MB)
 */
export function isValidLogoFileSize(size: number): boolean {
  const maxSize = 5 * 1024 * 1024; // 5MB
  return size > 0 && size <= maxSize;
}

/**
 * Get the appropriate MIME type for a file extension
 */
export function getMimeTypeFromExtension(extension: string): string {
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'svg': 'image/svg+xml'
  };
  return mimeTypes[extension.toLowerCase()] || 'image/png';
}