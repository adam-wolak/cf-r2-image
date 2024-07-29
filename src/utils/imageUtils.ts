import { saveImageToR2 } from './r2Storage';
import { transformImage } from '../transformers/imageTransformer';
import { config } from '../config';

const MAX_RETRIES = 3;

export function getOptimizedImagePath(imagePath: string, format: string): string {
  const parts = imagePath.split('.');
  const extension = parts.pop();
  const basePath = parts.join('.');
  return `${basePath}.${format}`;
}

export function isImagePath(path: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];
  return imageExtensions.some(ext => path.toLowerCase().endsWith(ext));
}

export function getBestImageFormat(acceptHeader: string): string {
  if (acceptHeader.includes('image/avif')) return 'avif';
  if (acceptHeader.includes('image/webp')) return 'webp';
  return 'jpg'; // Default to JPEG if no modern format is supported
}

export async function getOrCreateImage(imagePath: string, env: Env, format: string): Promise<ArrayBuffer | null> {
  const optimizedPath = getOptimizedImagePath(imagePath, format);
  
  console.log(`Processing image: ${imagePath}`);

  console.log(`Checking for optimized image in R2: ${optimizedPath}`);
  const optimizedImage = await env.R2_BUCKET.get(optimizedPath);
  if (optimizedImage) {
    console.log(`Optimized image found in R2: ${optimizedPath}`);
    return optimizedImage.arrayBuffer();
  }

  console.log(`Optimized image not found in R2, transforming: ${imagePath}`);
  const params = { ...config.TRANSFORM_PARAMS };
  const transformedBuffer = await transformImage(imagePath, params, format);
  
  if (!transformedBuffer) {
    console.error(`Failed to transform image: ${imagePath}`);
    return null;
  }

  console.log(`Saving transformed image to R2: ${optimizedPath}`);
  try {
    await saveImageToR2(env, optimizedPath, transformedBuffer, `image/${format}`);
    console.log(`Successfully saved optimized image to R2: ${optimizedPath}`);
  } catch (error) {
    console.error(`Failed to save optimized image to R2: ${optimizedPath}`, error);
  }

  return transformedBuffer;
}
