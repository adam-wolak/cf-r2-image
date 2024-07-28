import { config } from '../config';
import { getFromR2, saveToR2 } from './r2Storage';
import { transformImage } from '../transformers/imageHandler';

export function isImagePath(path: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(path);
}

import { config } from '../config';

export function getOptimizedImagePath(path: string, format: string): string {
  // Usuń początkowy slash, jeśli istnieje
  path = path.replace(/^\/+/, '');
  // Zamień rozszerzenie na nowy format
  return path.replace(/\.(jpg|jpeg|png|gif|webp)$/i, `.${format}`);
}

export function getBestImageFormat(accept: string): string {
  if (accept.includes('image/avif')) return 'avif';
  if (accept.includes('image/webp')) return 'webp';
  return 'jpeg'; // fallback to jpeg
}

export async function getOrCreateImage(bucket: R2Bucket, imagePath: string, format: string): Promise<string> {
  imagePath = imagePath.replace(/^\/+/, '');
  const originalPath = imagePath.replace(/-\d+x\d+(?=\.[a-z]+$)/, '');
  const optimizedPath = getOptimizedImagePath(originalPath, format);
  
  console.log(`Checking for optimized image: ${optimizedPath}`);
  let optimizedImage = await bucket.get(optimizedPath);

  if (!optimizedImage) {
    console.log('Optimized image not found, checking for original...');
    let originalImage = await bucket.get(originalPath);

    if (!originalImage) {
      console.log('Original image not found in R2, fetching from origin...');
      const originalImageUrl = `${config.ORIGIN}/${originalPath}`;
      console.log(`Fetching original image from: ${originalImageUrl}`);
      const response = await fetch(originalImageUrl);
      if (!response.ok) {
        console.error(`Failed to fetch original image: ${response.status} ${response.statusText}`);
        return `${config.ORIGIN}/${originalPath}`; // Zwróć oryginalny URL w przypadku błędu
      }
      const originalImageBuffer = await response.arrayBuffer();
      console.log('Saving original image to R2...');
      await bucket.put(originalPath, originalImageBuffer);
      originalImage = await bucket.get(originalPath);
    }

    if (!originalImage) {
      console.error('Failed to get original image after saving to R2');
      return `${config.ORIGIN}/${originalPath}`; // Zwróć oryginalny URL w przypadku błędu
    }

    console.log('Transforming image...');
    try {
      const transformedImage = await transformImage(await originalImage.arrayBuffer(), originalPath, format);
      console.log('Saving optimized image to R2...');
      await bucket.put(optimizedPath, transformedImage);
      optimizedImage = await bucket.get(optimizedPath);
    } catch (error) {
      console.error('Error during image transformation:', error);
      return `${config.R2_PUB}/${originalPath}`; // Zwróć oryginalny obraz z R2 w przypadku błędu transformacji
    }
  }

  if (!optimizedImage) {
    console.error('Failed to get optimized image after saving to R2');
    return `${config.R2_PUB}/${originalPath}`; // Zwróć oryginalny obraz z R2 w przypadku błędu
  }

  return `${config.R2_PUB}/${optimizedPath}`;
}

export function getImageDimensions(imagePath: string): { width?: number; height?: number } {
  const match = imagePath.match(/-(\d+)x(\d+)\./);
  if (match) {
    return {
      width: parseInt(match[1], 10),
      height: parseInt(match[2], 10)
    };
  }
  return {};
}

