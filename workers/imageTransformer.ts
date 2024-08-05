import { Env, R2Bucket } from '../types';
import { getOptimalImageFormat } from '../utils/browserUtils';
import { parseImageDimensions } from '../utils/htmlUtils';

async function ensureTransformedImageInR2(imageKey: string, bucket: R2Bucket, env: Env, userAgent: string): Promise<string[]> {
  const optimalFormat = getOptimalImageFormat(userAgent);
  const transformedKeys: string[] = [];

  // Lista wszystkich obiektów w buckecie z prefiksem imageKey
  const listResult = await bucket.list({ prefix: imageKey.split('.')[0] });

  for (const object of listResult.objects) {
    const originalKey = object.key;
    const transformedKey = `transformed/${optimalFormat}/${originalKey}`;

    const existingObject = await bucket.head(transformedKey);
    
    if (!existingObject) {
      const transformParams = new URLSearchParams({
        format: optimalFormat,
        quality: env.TRANSFORM_PARAMS.quality,
      });

      const imageUrl = `${env.R2_PUB}/${originalKey}`;
      const transformUrl = `${env.IMAGE_TRANSFORMER_WORKER}?${transformParams.toString()}&url=${encodeURIComponent(imageUrl)}`;

      const response = await fetch(transformUrl);
      if (!response.ok) {
        throw new Error(`Failed to transform image: ${response.statusText}`);
      }

      const transformedArrayBuffer = await response.arrayBuffer();

      await bucket.put(transformedKey, transformedArrayBuffer, {
        httpMetadata: {
          'Content-Type': `image/${optimalFormat}`,
          'Cache-Control': env.R2_CACHE_CONTROL,
        },
      });

      console.log(`Transformed image saved to R2: ${transformedKey}`);
    } else {
      console.log(`Transformed image already exists in R2: ${transformedKey}`);
    }

    transformedKeys.push(transformedKey);
  }

  return transformedKeys;
}


async function ensureImageInR2(imageUrl: string, bucket: R2Bucket, env: Env): Promise<void> {
  const url = new URL(imageUrl);
  const key = url.pathname.slice(1);

  const existingObject = await bucket.head(key);
  if (existingObject) {
    console.log(`Image already exists in R2: ${key}`);
    return;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  await bucket.put(key, arrayBuffer, {
    httpMetadata: response.headers,
  });

  console.log(`Image saved to R2: ${key}`);
}

export { ensureImageInR2, ensureTransformedImageInR2 };
