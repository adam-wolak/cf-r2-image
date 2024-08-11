import { normalizeUrl, getKeyFromUrl } from './imageUtils';

import { Env } from '../types';

export async function ensureImageInR2(imageUrl: string, bucket: R2Bucket, env: Env): Promise<void> {
  const key = getKeyFromUrl(imageUrl);
  try {
    const existing = await bucket.head(key);

    if (!existing) {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error('Invalid content type');
      }
      const arrayBuffer = await response.arrayBuffer();
      await bucket.put(key, arrayBuffer, {
        httpMetadata: { contentType: contentType },
      });
      console.log(`Saved image to R2: ${imageUrl}`);
    } else {
      console.log(`Image already exists in R2: ${imageUrl}`);
    }
  } catch (error) {
    console.error(`Error in ensureImageInR2 for ${imageUrl}:`, error);
    throw error; // Re-throw the error to be caught in the calling function
  }
}


export async function ensureTransformedImageInR2(imageKey: string, bucket: R2Bucket, env: Env, optimalFormat: string, width?: number, height?: number): Promise<string> {
  const extension = optimalFormat === 'jpg' ? 'jpeg' : optimalFormat;
  const transformedKey = imageKey.replace(/\.[^/.]+$/, `-${width}x${height}.${extension}`);

  const existingObject = await bucket.head(transformedKey);
  if (existingObject) {
    console.log(`Transformed image already exists in R2: ${transformedKey}`);
    return transformedKey;
  }

  let transformOptions = `format=${optimalFormat}`;
  if (width) transformOptions += `,width=${width}`;
  if (height) transformOptions += `,height=${height}`;

  const cfImageUrl = new URL(`${env.CLOUDFLARE_ZONE}/cdn-cgi/image/${transformOptions}/${imageKey}`);

  const response = await fetch(cfImageUrl.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch transformed image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  await bucket.put(transformedKey, arrayBuffer, {
    httpMetadata: {
      contentType: `image/${optimalFormat === 'jpg' ? 'jpeg' : optimalFormat}`,
    },
  });

  console.log(`Saved transformed image to R2: ${transformedKey}`);
  return transformedKey;
}
