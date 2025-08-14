# District Branding Implementation Guide

## Overview

This guide covers the implementation of district branding features in the JSWP Online application, including database schema updates, file storage configuration, security policies, and best practices.

## Database Schema Changes

### New Columns Added to `districts` Table

```sql
-- Logo storage URL
logo_url TEXT

-- Brand colors (hex format)
primary_color VARCHAR(7)
secondary_color VARCHAR(7)
```

### Validation Constraints

- **Color Format**: Must be valid 6-digit hex colors (e.g., `#FF0000`)
- **URL Format**: Must be valid HTTP/HTTPS URLs
- **Null Values**: All branding fields are optional

## Storage Configuration

### Bucket Setup

- **Bucket Name**: `district-logos`
- **Public Access**: Read-only for all users
- **File Size Limit**: 5MB maximum
- **Allowed MIME Types**:
  - `image/jpeg`
  - `image/jpg`
  - `image/png`
  - `image/webp`
  - `image/svg+xml`

### File Organization Structure

```
district-logos/
├── district-{uuid1}/
│   └── logo.png
├── district-{uuid2}/
│   └── logo.webp
└── district-{uuid3}/
    └── logo.svg
```

### Naming Conventions

- **Folder Pattern**: `district-{district_id}`
- **File Pattern**: `logo.{extension}`
- **Full Path**: `district-{district_id}/logo.{extension}`

## Security Implementation

### Row Level Security (RLS) Policies

#### Districts Table

1. **Public Read Access**: All users can view district branding information
2. **Super Admin Only**: Only super admins can modify district branding
3. **Authenticated Users**: Can view their own district's complete information

#### Storage Policies

1. **Public Read**: All district logos are publicly readable
2. **Super Admin Upload**: Only super admins can upload/modify logos
3. **Super Admin Delete**: Only super admins can delete logos

### Access Control Matrix

| Role | View Branding | Modify Branding | Upload Logo | Delete Logo |
|------|---------------|-----------------|-------------|-------------|
| Public | ✅ | ❌ | ❌ | ❌ |
| Student | ✅ | ❌ | ❌ | ❌ |
| Teacher | ✅ | ❌ | ❌ | ❌ |
| School Admin | ✅ | ❌ | ❌ | ❌ |
| District Admin | ✅ | ❌ | ❌ | ❌ |
| Super Admin | ✅ | ✅ | ✅ | ✅ |

## Implementation Best Practices

### File Upload Security

#### Client-Side Validation
```typescript
import { validateLogoFile } from '@/lib/district-branding.utils'

const validation = validateLogoFile(file)
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors)
  return
}
```

#### Server-Side Validation
- Always validate file size and type on the server
- Implement virus scanning for uploaded files
- Use secure file naming to prevent path traversal attacks

### Performance Optimization

#### Image Optimization
- Compress images before upload
- Use modern formats (WebP, AVIF) when supported
- Implement responsive images with multiple sizes
- Consider CDN integration for better performance

#### Caching Strategy
```typescript
// Cache district branding data
const brandingCache = new Map<string, DistrictBranding>()

async function getCachedBranding(districtId: string): Promise<DistrictBranding> {
  if (brandingCache.has(districtId)) {
    return brandingCache.get(districtId)!
  }
  
  const branding = await fetchDistrictBranding(districtId)
  brandingCache.set(districtId, branding)
  return branding
}
```

### Color Accessibility

#### Contrast Requirements
- Minimum contrast ratio: 4.5:1 for normal text
- Minimum contrast ratio: 3:1 for large text
- Use the provided utility functions to check contrast

#### Implementation Example
```typescript
import { createColorTheme, getContrastRatio } from '@/lib/district-branding.utils'

const theme = createColorTheme(districtBranding)
const contrast = getContrastRatio(theme.primary, '#FFFFFF')

if (contrast < 4.5) {
  console.warn('Low contrast detected - consider adjusting colors')
}
```

## File Management

### Upload Process

1. **Client-Side Validation**
   - File size (max 5MB)
   - File type (images only)
   - File name sanitization

2. **Server-Side Processing**
   - Security validation
   - Image optimization
   - Path generation
   - Storage upload

3. **Database Update**
   - Update district record with new logo URL
   - Clean up old logo files (if applicable)

### File Cleanup

#### Automatic Cleanup
```sql
-- Helper function for cleaning up old logos
SELECT cleanup_district_logos('district-uuid-here');
```

#### Manual Cleanup
- Implement scheduled jobs to remove orphaned files
- Monitor storage usage and implement retention policies
- Keep audit logs of file operations

## API Integration

### Fetching District Branding

```typescript
// Using helper functions
const branding = await supabase
  .rpc('get_district_branding_by_id', { district_id: districtId })
  .single()

// Direct query
const { data: branding } = await supabase
  .from('districts')
  .select('id, name, logo_url, primary_color, secondary_color')
  .eq('id', districtId)
  .single()
```

### Updating District Branding

```typescript
// Validate before update
const validation = validateDistrictBranding(updateData)
if (!validation.isValid) {
  throw new Error('Invalid branding data')
}

// Update district
const { error } = await supabase
  .from('districts')
  .update({
    logo_url: logoUrl,
    primary_color: primaryColor,
    secondary_color: secondaryColor
  })
  .eq('id', districtId)
```

## CSS Integration

### Using CSS Custom Properties

```typescript
import { generateBrandingCssVars } from '@/lib/district-branding.utils'

// Generate CSS variables
const cssVars = generateBrandingCssVars(districtBranding)

// Apply to document
Object.entries(cssVars).forEach(([property, value]) => {
  document.documentElement.style.setProperty(property, value)
})
```

### Tailwind CSS Integration

```css
/* Use in Tailwind config */
:root {
  --district-primary: #3B82F6;
  --district-secondary: #64748B;
}

/* Use in components */
.btn-primary {
  @apply bg-[var(--district-primary)] text-[var(--district-primary-contrast)];
}
```

## Error Handling

### Common Errors and Solutions

#### File Upload Errors
- **File too large**: Implement chunked upload for large files
- **Invalid file type**: Provide clear error messages and supported formats
- **Network timeout**: Implement retry logic with exponential backoff

#### Validation Errors
- **Invalid hex color**: Provide color picker with validation
- **Missing permissions**: Check user role before allowing operations
- **Database constraints**: Handle constraint violations gracefully

## Monitoring and Maintenance

### Health Checks
- Monitor storage bucket usage
- Check for orphaned files
- Validate logo URL accessibility
- Monitor performance impact

### Audit Logging
```sql
-- Track branding changes
CREATE TABLE district_branding_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  district_id UUID REFERENCES districts(id),
  changed_by UUID REFERENCES user_profiles(id),
  change_type TEXT, -- 'logo_upload', 'color_update', etc.
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Migration Checklist

- [ ] Run database migration script
- [ ] Configure storage bucket
- [ ] Test file upload permissions
- [ ] Verify RLS policies
- [ ] Update TypeScript types
- [ ] Test API endpoints
- [ ] Implement UI components
- [ ] Test color contrast compliance
- [ ] Set up monitoring
- [ ] Document custom implementations

## Troubleshooting

### Common Issues

1. **Logo not displaying**
   - Check file permissions
   - Verify URL format
   - Confirm bucket configuration

2. **Upload failures**
   - Check file size limits
   - Verify user permissions
   - Check storage bucket policies

3. **Color validation errors**
   - Ensure proper hex format
   - Check for special characters
   - Validate color picker integration

### Debug Commands

```sql
-- Check district branding data
SELECT id, name, logo_url, primary_color, secondary_color 
FROM districts WHERE id = 'your-district-id';

-- Check storage objects
SELECT * FROM storage.objects 
WHERE bucket_id = 'district-logos';

-- Check user permissions
SELECT role FROM user_profiles WHERE id = auth.uid();
```

## Support and Resources

- Database schema: `C:\Users\RaymondJenkins\Desktop\CODE\jswp-online\lib\database.types.ts`
- Utility functions: `C:\Users\RaymondJenkins\Desktop\CODE\jswp-online\lib\district-branding.utils.ts`
- Type definitions: `C:\Users\RaymondJenkins\Desktop\CODE\jswp-online\lib\district-branding.types.ts`
- Migration scripts: `C:\Users\RaymondJenkins\Desktop\CODE\jswp-online\migrations/`