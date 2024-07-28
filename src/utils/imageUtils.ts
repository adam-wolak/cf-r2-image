import { config } from '../config';
import { getFromR2, saveToR2 } from './r2Storage';
import { transformImage } from '../transformers/imageHandler';

export function isImagePath(path: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(path);
}

import { config } from '../config';

export function getOptimizedImagePath(path: string, format: string): string {
  // Usuń początkowy slash, jeśli istnieje
  path = path.replace(/^\//, '');
  // Zamień rozszerzenie na nowy format
  const newPath = path.replace(/\.(jpg|jpeg|png|gif|webp)$/i, `.${format}`);
  return `${config.R2_PUB}/${config.R2_BUCKET_NAME}/${newPath}`;
}

export function getOriginalImagePath(path: string): string {
  return path.replace(/-\d+x\d+\.(jpg|jpeg|png|gif|webp)$/i, '.$1');
}

export function getImageDimensions(path: string): { width: number | null, height: number | null } {
  const match = path.match(/-(\d+)x(\d+)\.(jpg|jpeg|png|gif|webp)$/i);
  return {
    width: match ? parseInt(match[1]) : null,
    height: match ? parseInt(match[2]) : null
  };
}

export function getBestImageFormat(accept: string): string {
  if (accept.includes('image/avif')) return 'avif';
  if (accept.includes('image/webp')) return 'webp';
  return 'jpeg'; // fallback to jpeg
}

export async function getOrCreateImage(bucket: R2Bucket, imagePath: string, format: string): Promise<ArrayBuffer> {
  const optimizedPath = getOptimizedImagePath(imagePath, format).replace(`${config.R2_PUB}/${config.R2_BUCKET_NAME}/`, '');
  console.log(`Checking for optimized image: ${optimizedPath}`);
  let optimizedImage = await getFromR2(bucket, optimizedPath);

  if (!optimizedImage) {
    console.log('Optimized image not found, creating...');
    const originalImageUrl = `${config.ORIGIN}${imagePath}`;
    console.log(`Fetching original image from: ${originalImageUrl}`);
    const originalImage = await fetch(originalImageUrl).then(res => res.arrayBuffer());
    console.log('Original image fetched, transforming...');
    optimizedImage = await transformImage(originalImage, imagePath, format);
    console.log('Image transformed, saving to R2...');
    await saveToR2(bucket, optimizedPath, optimizedImage);
    console.log('Optimized image created and saved to R2');
  } else {
    console.log('Optimized image found in R2');
  }

  return optimizedImage;
}
