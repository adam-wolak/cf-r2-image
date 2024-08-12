import { Env } from '../types';

export async function getNewImages(bucket: R2Bucket, imageMap: Map<string, ArrayBuffer>, requestId: string): Promise<Map<string, ArrayBuffer>> {
  const existingImages = await listExistingImagesInR2(bucket, requestId);
  const newImages = new Map<string, ArrayBuffer>();

  for (const [path, buffer] of imageMap.entries()) {
    if (!existingImages.has(path)) {
      newImages.set(path, buffer);
    }
  }

  console.log(`[${requestId}] Found ${newImages.size} new images to save`);
  return newImages;
}

async function listExistingImagesInR2(bucket: R2Bucket, requestId: string): Promise<Set<string>> {
  const existingImages = new Set<string>();
  let truncated = true;
  let cursor: string | undefined;

  while (truncated) {
    const listed = await bucket.list({ prefix: 'wp-content/uploads/', cursor });
    for (const object of listed.objects) {
      existingImages.add(object.key);
    }
    truncated = listed.truncated;
    cursor = listed.truncated ? listed.cursor : undefined;
  }

  console.log(`[${requestId}] Found ${existingImages.size} existing images in R2`);
  return existingImages;
}

export async function saveNewImagesToR2(bucket: R2Bucket, newImages: Map<string, ArrayBuffer>, requestId: string): Promise<string[]> {
  const savedImages: string[] = [];
  for (const [path, buffer] of newImages.entries()) {
    await bucket.put(path, buffer, {
      httpMetadata: { contentType: getMimeType(path) },
    });
    savedImages.push(path);
    console.log(`[${requestId}] Saved new image to R2: ${path}`);
  }
  return savedImages;
}

function getMimeType(path: string): string {
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}
