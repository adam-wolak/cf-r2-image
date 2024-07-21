import { config } from '../config';

export async function getImageFromR2(key: string, bucket: R2Bucket): Promise<ArrayBuffer | null> {
  console.log('Getting image from R2:', key);
  try {
    const object = await bucket.get(key);
    if (object === null) {
      console.log('Image not found in R2');
      return null;
    }
    console.log('Image found in R2');
    return await object.arrayBuffer();
  } catch (error) {
    console.error('Error getting image from R2:', error);
    return null;
  }
}

export async function saveImageToR2(key: string, data: ArrayBuffer, bucket: R2Bucket): Promise<void> {
  console.log('Saving image to R2:', key);
  try {
    await bucket.put(key, data, {
      httpMetadata: {
        cacheControl: config.R2_CACHE_CONTROL,
        contentType: getContentTypeFromKey(key),
      },
    });
    console.log('Image saved to R2');
  } catch (error) {
    console.error('Error saving image to R2:', error);
  }
}

function getContentTypeFromKey(key: string): string {
  const extension = key.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

export async function deleteImageFromR2(key: string, bucket: R2Bucket): Promise<void> {
  console.log('Deleting image from R2:', key);
  try {
    await bucket.delete(key);
    console.log('Image deleted from R2');
  } catch (error) {
    console.error('Error deleting image from R2:', error);
  }
}

export async function listImagesInR2(bucket: R2Bucket, prefix?: string): Promise<string[]> {
  console.log('Listing images in R2');
  try {
    const options: R2ListOptions = prefix ? { prefix } : {};
    const list = await bucket.list(options);
    const keys = list.objects.map(obj => obj.key);
    console.log(`Found ${keys.length} images in R2`);
    return keys;
  } catch (error) {
    console.error('Error listing images in R2:', error);
    return [];
  }
}

export async function getR2ObjectMetadata(key: string, bucket: R2Bucket): Promise<R2Object | null> {
  console.log('Getting R2 object metadata:', key);
  try {
    const object = await bucket.head(key);
    if (object === null) {
      console.log('Object not found in R2');
      return null;
    }
    console.log('Object metadata retrieved from R2');
    return object;
  } catch (error) {
    console.error('Error getting R2 object metadata:', error);
    return null;
  }
}
