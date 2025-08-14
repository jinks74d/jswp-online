// components/ui/DistrictLogo.tsx
"use client";

import { useState } from 'react';
import Image from 'next/image';
import { Building2 } from 'lucide-react';

interface DistrictLogoProps {
  districtId: string;
  districtName: string;
  className?: string;
  size?: number;
  fallbackIcon?: boolean;
}

export default function DistrictLogo({ 
  districtId, 
  districtName, 
  className = "", 
  size = 40,
  fallbackIcon = true 
}: DistrictLogoProps) {
  const [logoError, setLogoError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Early validation - if no districtId, show fallback immediately
  if (!districtId) {
    console.warn('DistrictLogo: No districtId provided', { districtId, districtName });
    return fallbackIcon ? (
      <div 
        className={`flex items-center justify-center bg-gray-100 rounded ${className}`}
        style={{ width: size, height: size }}
      >
        <Building2 
          className="text-gray-400" 
          size={Math.max(16, size * 0.4)} 
        />
      </div>
    ) : null;
  }

  const logoUrl = `/api/districts/${districtId}/logo`;

  // Debug logging
  console.log('DistrictLogo render:', { districtId, districtName, logoUrl, logoError, isLoading });

  const handleImageError = (e: any) => {
    // More graceful error logging - don't log empty objects that cause console errors
    if (process.env.NODE_ENV === 'development') {
      console.log('DistrictLogo: Image failed to load, using fallback', {
        districtId,
        districtName,
        logoUrl: logoUrl || 'No URL',
        hasValidUrl: !!(logoUrl && logoUrl !== '/api/districts/undefined/logo')
      });
    }
    
    setLogoError(true);
    setIsLoading(false);
  };

  const handleImageLoad = () => {
    console.log('DistrictLogo image loaded successfully:', {
      districtId,
      districtName,
      logoUrl
    });
    setIsLoading(false);
    setLogoError(false);
  };

  // Show fallback if error or no fallback icon requested
  if (logoError || !fallbackIcon) {
    return fallbackIcon ? (
      <div 
        className={`flex items-center justify-center bg-gray-100 rounded ${className}`}
        style={{ width: size, height: size }}
      >
        <Building2 
          className="text-gray-400" 
          size={Math.max(16, size * 0.4)} 
        />
      </div>
    ) : null;
  }

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded animate-pulse"
        >
          <Building2 className="text-gray-300" size={Math.max(16, size * 0.4)} />
        </div>
      )}
      {/* Use regular img tag for SVGs, Next.js Image for other formats */}
      {logoUrl.includes('.svg') ? (
        <img
          src={logoUrl}
          alt={`${districtName} logo`}
          width={size}
          height={size}
          className={`rounded object-contain ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      ) : (
        <Image
          src={logoUrl}
          alt={`${districtName} logo`}
          width={size}
          height={size}
          className={`rounded object-contain ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
          onError={handleImageError}
          onLoad={handleImageLoad}
          priority={size > 60} // Priority for larger logos
        />
      )}
    </div>
  );
}
