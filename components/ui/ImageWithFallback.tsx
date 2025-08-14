// components/ui/ImageWithFallback.tsx
"use client";

import { useState } from "react";
import Image from "next/image";

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fallbackSrc?: string;
  priority?: boolean;
  fill?: boolean;
  sizes?: string;
  style?: React.CSSProperties;
}

export function ImageWithFallback({
  src,
  alt,
  width,
  height,
  className = "",
  fallbackSrc = "/images/placeholder.png",
  priority = false,
  fill = false,
  sizes,
  style,
  ...props
}: ImageWithFallbackProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(fallbackSrc);
    }
  };

  // Determine if the image is an SVG
  const isSvg = imgSrc?.toLowerCase().includes(".svg");

  // For SVG files, use a regular img tag to avoid Next.js Image optimization issues
  if (isSvg) {
    return (
      <img
        src={imgSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        style={style}
        onError={handleError}
        {...props}
      />
    );
  }

  // For other image formats, use Next.js Image component
  const imageProps = {
    src: imgSrc,
    alt,
    className,
    priority,
    onError: handleError,
    style,
    ...props,
  };

  if (fill) {
    return <Image {...imageProps} fill sizes={sizes} />;
  }

  return <Image {...imageProps} width={width || 100} height={height || 100} />;
}

// Utility function to check if a URL is a valid image
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;

  const imageExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".avif",
    ".svg",
  ];
  const lowercaseUrl = url.toLowerCase();

  return (
    imageExtensions.some((ext) => lowercaseUrl.includes(ext)) ||
    lowercaseUrl.startsWith("data:image/") ||
    lowercaseUrl.includes("supabase") || // Supabase storage URLs
    lowercaseUrl.includes("blob:")
  ); // Blob URLs
}

// Utility function to get optimized image URL
export function getOptimizedImageUrl(
  url: string,
  width?: number,
  height?: number
): string {
  if (!url) return "";

  // If it's a Supabase storage URL, you can add transformation parameters
  if (url.includes("supabase")) {
    const params = new URLSearchParams();
    if (width) params.append("width", width.toString());
    if (height) params.append("height", height.toString());
    params.append("resize", "cover");
    params.append("quality", "80");

    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}${params.toString()}`;
  }

  return url;
}
