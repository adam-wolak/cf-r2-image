// src/utils/imageUtils.ts

export function getKeyFromUrl(url: string): string {
  const urlObj = new URL(url);
  return urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
}

export function normalizeUrl(url: string): string {
  return url.replace(/([^:]\/)\/+/g, "$1");
}

export function addOriginalVersion(url: string): string | null {
  const match = url.match(/(.+)-\d+x\d+(\.[^.]+)$/);
  if (match) {
    return `${match[1]}${match[2]}`;
  }
  return null;
}

export function removeImageDimensions(url: string): string {
  return url.replace(/-\d+x\d+(\.[^.]+)$/, '$1');
}
