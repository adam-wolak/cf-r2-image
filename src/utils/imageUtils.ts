// src/utils/imageUtils.ts
import { ImageInfo } from '../types';


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

export function normalizeUrl(url: string, baseUrl: string): string {
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  if (url.startsWith('/')) {
    return `${baseUrl}${url}`;
  }
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
    return `${baseUrl}/${url}`;
  }
  return url;
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


export async function processAndUploadImage(bucket: R2Bucket, url: string, imageBuffer: ArrayBuffer): Promise<any> {
  const key = new URL(url).pathname;
  
  try {
    const existingObject = await bucket.head(key);
    if (existingObject) {
      return { status: 'skipped', message: 'Image already exists in R2', url };
    }

    await bucket.put(key, imageBuffer);
    return { status: 'saved', message: 'Image successfully saved to R2', url };
  } catch (error) {
    console.error(`Error processing/uploading image ${url}:`, error);
    throw error;
  }
}

