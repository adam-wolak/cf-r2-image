import { config } from '../config';

export async function getFromR2(bucket: R2Bucket, key: string): Promise<ArrayBuffer | null> {
  const object = await bucket.get(key);
  return object ? await object.arrayBuffer() : null;
}

export async function saveImageToR2(env: Env, key: string, value: ArrayBuffer, contentType: string): Promise<void> {
  try {
    await env.R2_BUCKET.put(key, value, {
      httpMetadata: {
        contentType: contentType,
      },
    });
    console.log(`Successfully saved to R2: ${key}`);
  } catch (error) {
    console.error(`Error saving to R2: ${key}`, error);
    throw error;
  }
}

