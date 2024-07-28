import { config } from '../config';

export async function getFromR2(bucket: R2Bucket, key: string): Promise<ArrayBuffer | null> {
  const object = await bucket.get(key);
  return object ? await object.arrayBuffer() : null;
}

export async function saveToR2(bucket: R2Bucket, key: string, value: ArrayBuffer): Promise<void> {
  await bucket.put(key, value, {
    httpMetadata: {
      cacheControl: config.R2_CACHE_CONTROL
    }
  }
);
  console.log(`Saved to R2: ${key}`);

}

