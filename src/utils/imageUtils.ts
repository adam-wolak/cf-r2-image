// src/utils/imageUtils.ts

export function extractImagePath(url: string): string | null {
  const match = url.match(/wp-content\/uploads\/.+/);
  return match ? match[0] : null;
}

export function getKeyFromUrl(url: string): string {
  const urlObj = new URL(url);
  const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
  console.log(`Generated key for ${url}: ${key}`);
  return key;
}

export function normalizeUrl(url: string): string {
  if (!url) return '';
  const normalizedUrl = url.trim().toLowerCase();
  console.log(`Normalized URL: ${normalizedUrl}`);
  return normalizedUrl;
}

export function addOriginalVersion(url: string): string | null {
  if (url.toLowerCase().endsWith('.svg')) {
    return null;
  }
  const match = url.match(/(.+)-\d+x\d+(\.[^.]+)$/);
  if (match) {
    return `${match[1]}${match[2]}`;
  }
  return null;
}

export function removeImageDimensions(url: string): string {
  if (url.toLowerCase().endsWith('.svg')) {
    return '';
  }
  return url.replace(/-\d+x\d+(\.[^.]+)$/, '$1');
}
