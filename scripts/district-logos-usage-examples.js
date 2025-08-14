/**
 * DISTRICT LOGOS USAGE EXAMPLES
 * 
 * This file provides code examples for uploading and managing district logos
 * in your application after the storage bucket has been configured.
 */

// =====================================================
// 1. UPLOADING A DISTRICT LOGO (Super Admin Only)
// =====================================================

/**
 * Example: Upload a district logo
 * This function should be called from your admin interface
 */
async function uploadDistrictLogo(supabase, districtId, logoFile) {
  try {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(logoFile.type)) {
      throw new Error('Invalid file type. Only JPEG, PNG, WebP, and SVG files are allowed.');
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (logoFile.size > maxSize) {
      throw new Error('File too large. Maximum size is 5MB.');
    }

    // Get the correct file extension
    const fileExtension = logoFile.name.split('.').pop().toLowerCase();
    
    // Generate the standardized file path using the helper function
    const { data: filePath, error: pathError } = await supabase.rpc('get_district_logo_path', {
      district_id: districtId,
      file_extension: fileExtension
    });

    if (pathError) {
      throw new Error(`Error generating file path: ${pathError.message}`);
    }

    // Upload the file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('district-logos')
      .upload(filePath, logoFile, {
        cacheControl: '3600',
        upsert: true // Replace existing file if it exists
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get the public URL using the helper function
    const { data: publicUrl, error: urlError } = await supabase.rpc('get_district_logo_url', {
      district_id: districtId,
      file_extension: fileExtension
    });

    if (urlError) {
      throw new Error(`Error generating public URL: ${urlError.message}`);
    }

    // Update the districts table with the new logo URL
    const { error: updateError } = await supabase
      .from('districts')
      .update({ logo_url: publicUrl })
      .eq('id', districtId);

    if (updateError) {
      throw new Error(`Error updating district logo URL: ${updateError.message}`);
    }

    return {
      success: true,
      filePath: uploadData.path,
      publicUrl: publicUrl,
      message: 'District logo uploaded successfully'
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// =====================================================
// 2. GETTING A DISTRICT LOGO URL
// =====================================================

/**
 * Example: Get the public URL for a district logo
 */
async function getDistrictLogoUrl(supabase, districtId, fileExtension = 'png') {
  try {
    const { data: logoUrl, error } = await supabase.rpc('get_district_logo_url', {
      district_id: districtId,
      file_extension: fileExtension
    });

    if (error) {
      throw new Error(`Error getting logo URL: ${error.message}`);
    }

    return logoUrl;
  } catch (error) {
    console.error('Error getting district logo URL:', error.message);
    return null;
  }
}

// =====================================================
// 3. CLEANING UP OLD DISTRICT LOGOS (Super Admin Only)
// =====================================================

/**
 * Example: Clean up old logo files for a district
 */
async function cleanupDistrictLogos(supabase, districtId) {
  try {
    const { data: deletedCount, error } = await supabase.rpc('cleanup_district_logos', {
      district_id: districtId
    });

    if (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }

    return {
      success: true,
      deletedCount: deletedCount,
      message: `Cleaned up ${deletedCount} old logo files`
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// =====================================================
// 4. REACT COMPONENT EXAMPLE
// =====================================================

/**
 * Example React component for district logo upload
 */
const DistrictLogoUploader = ({ districtId, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const supabase = createClient(); // Your Supabase client

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const result = await uploadDistrictLogo(supabase, districtId, file);

    if (result.success) {
      onUploadComplete(result.publicUrl);
    } else {
      setError(result.error);
    }

    setUploading(false);
  };

  return (
    <div className="logo-uploader">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        onChange={handleFileUpload}
        disabled={uploading}
      />
      {uploading && <p>Uploading logo...</p>}
      {error && <p className="error">Error: {error}</p>}
    </div>
  );
};

// =====================================================
// 5. LOGO DISPLAY COMPONENT
// =====================================================

/**
 * Example React component to display district logo
 */
const DistrictLogo = ({ districtId, className = "" }) => {
  const [logoUrl, setLogoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchLogo() {
      // First try to get from districts table
      const { data: district } = await supabase
        .from('districts')
        .select('logo_url')
        .eq('id', districtId)
        .single();

      if (district?.logo_url) {
        setLogoUrl(district.logo_url);
      } else {
        // Fallback: try to construct URL for common extensions
        const extensions = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
        for (const ext of extensions) {
          const url = await getDistrictLogoUrl(supabase, districtId, ext);
          if (url) {
            setLogoUrl(url);
            break;
          }
        }
      }
      setLoading(false);
    }

    fetchLogo();
  }, [districtId]);

  if (loading) {
    return <div className="logo-placeholder">Loading logo...</div>;
  }

  if (!logoUrl) {
    return <div className="logo-placeholder">No logo available</div>;
  }

  return (
    <img 
      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}${logoUrl}`}
      alt="District Logo"
      className={className}
      onError={() => setLogoUrl(null)}
    />
  );
};

// =====================================================
// 6. FILE ORGANIZATION REFERENCE
// =====================================================

/*
EXPECTED FILE STRUCTURE IN STORAGE:

district-logos/
├── district-12345678-1234-1234-1234-123456789abc/
│   └── logo.png
├── district-87654321-4321-4321-4321-abcdefghijkl/
│   └── logo.jpg
└── district-11111111-2222-3333-4444-555555555555/
    └── logo.webp

NAMING RULES:
- Folder: district-{uuid}
- File: logo.{extension}
- Allowed extensions: jpg, jpeg, png, webp, svg
- Max file size: 5MB
- Public read access
- Super admin upload/modify only

EXAMPLE FULL URLS:
https://your-project.supabase.co/storage/v1/object/public/district-logos/district-12345678-1234-1234-1234-123456789abc/logo.png
*/

module.exports = {
  uploadDistrictLogo,
  getDistrictLogoUrl,
  cleanupDistrictLogos,
  DistrictLogoUploader,
  DistrictLogo
};